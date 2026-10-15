const { z } = require("zod");
const { ABILITIES, CLASSES, mod, classKey } = require("./rules");
const base = require("./creation-rules");
const { fail } = require("../lib/http");
const backgrounds = require("./data/Background.json");
const benefits = require("./data/BackgroundBenefit.json");
const species = require("./data/species-2024.json").results;
const names = {
  Acolyte: "Acólito",
  Criminal: "Criminal",
  Sage: "Sabio",
  Soldier: "Soldado",
};
const skillGrants = {
  "srd-2024_acolyte": ["insight", "religion"],
  "srd-2024_criminal": ["sleightOfHand", "stealth"],
  "srd-2024_sage": ["arcana", "history"],
  "srd-2024_soldier": ["athletics", "intimidation"],
};
function catalog() {
  return backgrounds.map(({ pk, fields }) => {
    const rows = benefits
      .filter((b) => b.fields.parent === pk)
      .map((b) => b.fields);
    const benefit = (type) => rows.find((r) => r.type === type).desc;
    return {
      key: pk,
      name: names[fields.name],
      abilities: benefit("ability_score").toLowerCase().split(", "),
      feat: benefit("feat"),
      skills: benefit("skill_proficiency"),
      skillGrants: [...skillGrants[pk]],
      tools: benefit("tool_proficiency"),
      equipment: benefit("equipment"),
      source: "Open5e · SRD 2024 · " + pk,
    };
  });
}
const increases = z
  .object(
    Object.fromEntries(
      ABILITIES.map((k) => [k, z.number().int().min(0).max(2)]),
    ),
  )
  .strict();
const schema = base.schema
  .extend({
    version: z.literal(1),
    ruleset: z.literal("srd-2024"),
    speciesKey: z.string().min(1).max(100),
    background: z
      .object({ key: z.string().min(1).max(100), increases })
      .strict(),
  })
  .strict();
function preview(input) {
  const data = schema.parse(input);
  const { version, ruleset, speciesKey, background, ...baseInput } = data;
  const validated = base.preview(baseInput);
  if (
    validated.pointsRemaining !== undefined &&
    validated.pointsRemaining !== 0
  )
    fail(422, "Repartí los 27 puntos antes de confirmar el trasfondo.");
  const selected = catalog().find((b) => b.key === background.key);
  if (!selected) fail(422, "Trasfondo no disponible en este catálogo.");
  const selectedSpecies = species.find(
    (s) => s.key === speciesKey && !s.is_subspecies,
  );
  if (!selectedSpecies) fail(422, "Especie no disponible en este catálogo.");
  const boosts = ABILITIES.map((k) => background.increases[k]);
  if (
    ABILITIES.some(
      (k) => background.increases[k] && !selected.abilities.includes(k),
    ) ||
    !["0,0,0,0,1,2", "0,0,0,1,1,1"].includes([...boosts].sort().join(","))
  )
    fail(
      422,
      "Elegí +2 y +1 en dos atributos distintos del trasfondo, o +1 en los tres.",
    );
  const finalScores = Object.fromEntries(
    ABILITIES.map((k) => [k, data.baseScores[k] + background.increases[k]]),
  );
  if (Object.values(finalScores).some((n) => n > 20))
    fail(422, "El trasfondo no puede elevar un atributo por encima de 20.");
  return {
    scope: "background-abilities",
    finalScores,
    modifiers: Object.fromEntries(
      ABILITIES.map((k) => [k, mod(finalScores[k])]),
    ),
    breakdown: ABILITIES.map((key) => ({
      key,
      base: data.baseScores[key],
      background: background.increases[key],
      total: finalScores[key],
    })),
    decision: {
      ...data,
      finalScores,
      background: {
        ...background,
        name: selected.name,
        skillGrants: [...selected.skillGrants],
        source: selected.source,
      },
      pending: ["originFeat", "tools", "equipment"],
    },
    speciesName: selectedSpecies.name,
    className: CLASSES[data.classKey].label,
  };
}
function forCharacter(input, character) {
  const result = preview(input);
  if (character.level !== 1)
    fail(
      422,
      "La creación con trasfondo admite nivel 1; la progresión se completa en una próxima entrega.",
    );
  if (
    character.race !== result.speciesName ||
    classKey(character.characterClass) !== input.classKey
  )
    fail(
      422,
      "La especie y la clase deben coincidir con las decisiones de creación.",
    );
  if (ABILITIES.some((k) => character[k] !== result.finalScores[k]))
    fail(
      422,
      "Los atributos guardados deben coincidir con la base más el trasfondo.",
    );
  return result.decision;
}
module.exports = { catalog, schema, preview, forCharacter };
