// Base ability creation only; background increases and character persistence are separate.
const { z } = require("zod");
const { ABILITIES, CLASSES, mod } = require("./rules");
const { features } = require("./class-features");
const snapshot = require("./data/classes-2024.json").results;
const { fail } = require("../lib/http");
const methods = {
  standard: { values: [15, 14, 13, 12, 10, 8] },
  pointBuy: {
    budget: 27,
    min: 8,
    max: 15,
    costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
  },
  rolled: { dice: 4, sides: 6, dropLowest: 1, count: 6 },
};
// Editorial suggestions, never mandatory allocation rules. Fighter defaults to Strength.
const suggestions = {
  barbarian: [
    "Combatiente resistente que canaliza su furia.",
    [0],
    [0, 2, 1, 4, 5, 3],
  ],
  bard: [
    "Artista que inspira a sus aliados y utiliza magia.",
    [5],
    [5, 1, 2, 4, 3, 0],
  ],
  cleric: [
    "Devoto que combina magia divina y apoyo al grupo.",
    [4],
    [4, 2, 0, 1, 5, 3],
  ],
  druid: [
    "Guardián de la naturaleza con magia y transformación.",
    [4],
    [4, 2, 1, 3, 5, 0],
  ],
  fighter: [
    "Especialista en armas y técnicas de combate.",
    [0, 1],
    [0, 2, 1, 4, 5, 3],
  ],
  monk: [
    "Combatiente ágil que desarrolla cuerpo y disciplina.",
    [1, 4],
    [1, 4, 2, 0, 3, 5],
  ],
  paladin: [
    "Guerrero que combina armas, protección y magia divina.",
    [0, 5],
    [0, 5, 2, 4, 1, 3],
  ],
  ranger: [
    "Explorador que combina armas y magia de la naturaleza.",
    [1, 4],
    [1, 4, 2, 0, 3, 5],
  ],
  rogue: [
    "Especialista en habilidades, sigilo y ataques precisos.",
    [1],
    [1, 2, 4, 3, 5, 0],
  ],
  sorcerer: [
    "Lanzador de conjuros que desarrolla su magia innata.",
    [5],
    [5, 2, 1, 4, 3, 0],
  ],
  warlock: [
    "Lanzador de conjuros con magia de pacto e invocaciones.",
    [5],
    [5, 2, 1, 4, 3, 0],
  ],
  wizard: [
    "Estudioso de la magia que reúne conjuros en su libro.",
    [3],
    [3, 2, 1, 4, 5, 0],
  ],
};
function catalog() {
  return {
    ruleset: "srd-2024",
    version: 1,
    abilityKeys: [...ABILITIES],
    methods: structuredClone(methods),
    classes: Object.entries(CLASSES).map(([key, cl]) => {
      const source = snapshot.find((c) => c.key === `srd-2024_${key}`);
      const [description, primary, order] = suggestions[key];
      return {
        key,
        skillChoices: require("./class-skills").definition(key),
        name: cl.label,
        description,
        primaryAbilities: primary.map((i) => ABILITIES[i]),
        recommendedOrder: order.map((i) => ABILITIES[i]),
        hitDie: cl.die,
        savingThrows: cl.saves.map((i) => ABILITIES[i]),
        coreTraits: source.features.find(
          (f) => f.feature_type === "CORE_TRAITS_TABLE",
        ).desc,
        levelOneFeatures: features([{ key, level: 1 }]).map(
          ({ name, description }) => ({ name, description }),
        ),
        progressionSummary:
          "Consultá la tabla de tu clase para conocer los rasgos y elecciones de cada nivel. Este catálogo muestra los rasgos de nivel 1 disponibles en la fuente; no resuelve la progresión.",
        source: `Open5e · ${source.document.name} · ${source.key}`,
      };
    }),
  };
}
const schema = z
  .object({
    classKey: z.enum(Object.keys(CLASSES)),
    method: z.enum(["standard", "pointBuy", "rolled"]),
    baseScores: z
      .object(
        Object.fromEntries(
          ABILITIES.map((k) => [k, z.number().int().min(3).max(18)]),
        ),
      )
      .strict(),
    rolls: z
      .array(z.array(z.number().int().min(1).max(6)).length(4))
      .length(6)
      .optional(),
  })
  .strict();
const sorted = (values) => [...values].sort((a, b) => b - a);
const samePool = (a, b) =>
  JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
function preview(input) {
  const data = schema.parse(input);
  const values = ABILITIES.map((k) => data.baseScores[k]);
  if (data.method !== "rolled" && data.rolls !== undefined)
    fail(422, "Las tiradas solo corresponden al método de tiradas.");
  let pointsRemaining;
  if (data.method === "standard" && !samePool(values, methods.standard.values))
    fail(422, "Asigná una vez cada valor de la serie estándar.");
  if (data.method === "pointBuy") {
    if (values.some((n) => n < 8 || n > 15))
      fail(422, "La compra de puntos admite valores entre 8 y 15.");
    pointsRemaining =
      27 - values.reduce((sum, n) => sum + methods.pointBuy.costs[n], 0);
    if (pointsRemaining < 0) fail(422, "La asignación supera los 27 puntos.");
  }
  if (data.method === "rolled") {
    if (!data.rolls) fail(422, "Incluí las seis tiradas de cuatro dados.");
    const pool = data.rolls.map(
      (dice) => dice.reduce((a, b) => a + b, 0) - Math.min(...dice),
    );
    if (!samePool(values, pool))
      fail(
        422,
        "Los atributos deben coincidir con las seis tiradas, descartando el menor dado de cada una.",
      );
  }
  const pool = sorted(
    data.method === "pointBuy" ? methods.standard.values : values,
  );
  return {
    ruleset: "srd-2024",
    scope: "base-abilities",
    baseScores: { ...data.baseScores },
    modifiers: Object.fromEntries(
      ABILITIES.map((k) => [k, mod(data.baseScores[k])]),
    ),
    ...(pointsRemaining === undefined ? {} : { pointsRemaining }),
    recommendedScores: Object.fromEntries(
      suggestions[data.classKey][2].map((index, i) => [
        ABILITIES[index],
        pool[i],
      ]),
    ),
  };
}
module.exports = { catalog, preview, schema };
