const { z } = require("zod");
const { CLASSES, ABILITIES, SKILLS } = require("./rules");
const id = z.string().uuid(),
  name = z.string().trim().min(1).max(160),
  int = (max = 10000) => z.number().int().min(0).max(max);
const armor = z
  .object({
    base: int(30),
    dexterity: z.boolean(),
    dexCap: z.number().int().min(0).max(99),
    shield: int(5),
    bonus: z.number().int().min(-10).max(10),
  })
  .strict();
const item = z
  .object({
    id,
    name,
    type: z.enum(["weapon", "armor", "shield", "gear"]),
    quantity: int(9999),
    equipped: z.boolean(),
    proficient: z.boolean().default(false),
    finesse: z.boolean().default(false),
    ranged: z.boolean().default(false),
    damage: z
      .string()
      .regex(/^\d{1,2}d(?:4|6|8|10|12|20)$/)
      .default("1d4"),
    range: z.string().max(80).default("5 ft"),
    notes: z.string().max(2000).default(""),
    bonus: z.number().int().min(-5).max(5).default(0),
    armor: armor.optional(),
  })
  .strict();
const spell = z
  .object({
    id,
    name,
    source: z.string().min(1).max(200),
    level: int(9),
    origin: z.enum(Object.keys(CLASSES)),
    prepared: z.boolean(),
    inSpellbook: z.boolean().default(false),
    concentration: z.boolean(),
    ritual: z.boolean(),
    castingTime: z.string().max(80),
    range: z.string().max(80),
    description: z.string().max(30000),
  })
  .strict();
const companion = z
  .object({
    id,
    name,
    kind: z.enum(["pet", "familiar", "class", "summon"]),
    source: z.string().min(1).max(300),
    hp: int(),
    maxHp: z.number().int().min(1).max(10000),
    notes: z.string().max(5000),
    active: z.boolean(),
  })
  .strict()
  .refine((c) => c.hp <= c.maxHp, "PV superiores al máximo");
const resource = z
  .object({
    id,
    name,
    current: int(),
    max: int(),
    recovery: z.enum(["short", "long", "manual"]),
  })
  .strict()
  .refine((x) => x.current <= x.max, "Recurso excede máximo");
const config = z
  .object({
    classes: z
      .array(
        z
          .object({
            key: z.enum(Object.keys(CLASSES)),
            level: z.number().int().min(1).max(20),
            subclass: z.string().max(100).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12)
      .refine(
        (a) => new Set(a.map((x) => x.key)).size === a.length,
        "Clase repetida",
      ),
    hp: z
      .object({
        current: int(),
        max: z.number().int().min(1).max(10000),
        temp: int(),
      })
      .strict(),
    xp: int(10000000),
    speed: int(200),
    armor,
    skills: z.record(
      z.enum(SKILLS.map((x) => x[0])),
      z.number().int().min(0).max(2),
    ),
    saveProficiencies: z.array(z.enum(ABILITIES)).max(6),
    resources: z.array(resource).max(40),
    features: z.array(z.enum(["trance"])).max(1),
  })
  .strict();
const operation = z.discriminatedUnion("type", [
  z.object({ type: z.literal("beginTurn"), data: z.object({}).strict() }),
  z.object({
    type: z.literal("savageAttacker"),
    data: z
      .object({ weaponId: id, critical: z.boolean().default(false) })
      .strict(),
  }),
  z.object({
    type: z.literal("money"),
    data: z
      .object({
        deltaCopper: z
          .number()
          .int()
          .min(-1000000000)
          .max(1000000000)
          .refine((n) => n !== 0),
      })
      .strict(),
  }),
  z.object({ type: z.literal("configure"), data: config }),
  z.object({
    type: z.literal("hp"),
    data: z
      .object({
        mode: z.enum(["damage", "heal", "temporary"]),
        amount: int(),
        critical: z.boolean().default(false),
      })
      .strict(),
  }),
  z.object({
    type: z.literal("roll"),
    data: z
      .object({
        kind: z.enum([
          "free",
          "save",
          "skill",
          "tool",
          "initiative",
          "attack",
          "death",
        ]),
        key: z.string().max(80).optional(),
        sides: z
          .union([
            z.literal(4),
            z.literal(6),
            z.literal(8),
            z.literal(10),
            z.literal(12),
            z.literal(20),
            z.literal(100),
          ])
          .optional(),
        count: z.number().int().min(1).max(50).optional(),
        modifier: z.number().int().min(-100).max(100).optional(),
        advantage: z.boolean().optional(),
        disadvantage: z.boolean().optional(),
      })
      .strict(),
  }),
  z.object({
    type: z.literal("rest"),
    data: z
      .object({
        kind: z.enum(["short", "long"]),
        hours: z.number().min(0).max(100),
        worldHour: int(10000000),
        trance: z.boolean().default(false),
        interrupted: z.boolean().default(false),
        interruptions: int(20).default(0),
      })
      .strict(),
  }),
  z.object({
    type: z.literal("arcaneRecovery"),
    data: z
      .object({ slots: z.array(z.number().int().min(1).max(5)).min(1).max(10) })
      .strict(),
  }),
  z.object({
    type: z.literal("hitDie"),
    data: z.object({ classKey: z.enum(Object.keys(CLASSES)) }).strict(),
  }),
  z.object({
    type: z.literal("resource"),
    data: z.object({ id, amount: z.number().int().min(1).max(10000) }).strict(),
  }),
  z.object({
    type: z.literal("cast"),
    data: z
      .object({
        id,
        slotLevel: int(9),
        originFeatUse: z.boolean().default(false),
        pool: z.enum(["standard", "pact"]).default("standard"),
        ritual: z.boolean().default(false),
        replaceConcentration: z.boolean().default(false),
      })
      .strict(),
  }),
  ...[
    ["inventory", "item", item],
    ["spell", "spell", spell],
    ["companion", "companion", companion],
  ].map(([type, key, schema]) =>
    z.object({
      type: z.literal(type),
      data: z.union([
        z.object({ operation: z.literal("upsert"), [key]: schema }).strict(),
        z.object({ operation: z.literal("remove"), id }).strict(),
      ]),
    }),
  ),
  z.object({
    type: z.literal("reductions"),
    data: z
      .object({ hp: int(), abilities: z.record(z.enum(ABILITIES), int(29)) })
      .strict(),
  }),
  z.object({
    type: z.literal("status"),
    data: z
      .object({
        exhaustion: int(6),
        conditions: z.array(z.string().max(80)).max(30),
        endConcentration: z.boolean(),
      })
      .strict(),
  }),
]);
const envelope = z
  .object({
    commandId: id,
    expectedVersion: int(2000000000),
    type: z.string(),
    data: z.unknown(),
  })
  .strict();
const section = z.object({ id, name, order: int(1000) }).strict();
const point = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();
const stroke = z
  .object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    width: z.number().min(1).max(30),
    points: z.array(point).min(1).max(2000),
  })
  .strict();
const note = z
  .object({
    title: name,
    sectionId: id,
    text: z.string().max(40000),
    strokes: z.array(stroke).max(300),
  })
  .strict();
module.exports = { envelope, operation, config, note, section };
