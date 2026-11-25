const { z } = require("zod");
const { ABILITIES, CLASSES, mod, classKey } = require("./rules");
const base = require("./creation-rules");
const { fail } = require("../lib/http");
const backgrounds = require("./data/Background.json");
const benefits = require("./data/BackgroundBenefit.json");
const species = require("./data/species-2024.json").results;
const loadout = require("./background-loadout");
const feats = require("./origin-feats");
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
      ...loadout.options(pk),
      originFeat: feats.definition(pk),
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
    startingDefense: z
      .object({ armorKey: z.string().min(1).max(40), shield: z.boolean() })
      .strict()
      .optional(),
    expertise: z.array(z.string().max(40)).length(2).optional(),
    classSkills: z.array(z.string().max(40)).max(4).optional(),
    speciesKey: z.string().min(1).max(100),
    background: z
      .object({
        key: z.string().min(1).max(100),
        increases,
        equipmentOption: z.enum(["A", "B"]).optional(),
        toolChoice: z.string().max(40).optional(),
        originFeatChoice: z
          .object({
            castingAbility: z.enum(["intelligence", "wisdom", "charisma"]),
            cantrips: z.array(z.string().max(100)).length(2),
            spell: z.string().max(100),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();
function preview(input) {
  const data = schema.parse(input);
  const {
    version,
    ruleset,
    speciesKey,
    background,
    classSkills,
    expertise,
    startingDefense,
    ...baseInput
  } = data;
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
  const classDecision = require("./class-skills").decide(
    data.classKey,
    classSkills,
  );
  if (expertise !== undefined) {
    const proficient = new Set([
      ...(classDecision?.skillGrants || []),
      ...selected.skillGrants,
    ]);
    if (
      data.classKey !== "rogue" ||
      !classDecision ||
      new Set(expertise).size !== 2 ||
      expertise.some((key) => !proficient.has(key))
    )
      fail(
        422,
        "El pícaro debe elegir dos habilidades distintas con competencia para su pericia.",
      );
    classDecision.expertiseGrants = [...expertise];
    classDecision.expertiseSource =
      "Open5e · SRD 2024 · srd-2024_rogue_expertise";
  }
  const supplies = loadout.decide(background.key, background);
  const originFeat = feats.decide(background.key, background.originFeatChoice);
  const result = {
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
      classBasics: require("./class-basics").decide(data.classKey, finalScores),
      ...(classDecision ? { classDecision } : {}),
      background: {
        ...background,
        ...supplies,
        ...(originFeat ? { originFeat } : {}),
        name: selected.name,
        skillGrants: [...selected.skillGrants],
        source: selected.source,
      },
      pending: [
        ...(originFeat ? [] : ["originFeat"]),
        ...(supplies.toolProficiencies.length ? [] : ["tools"]),
        ...(supplies.startingEquipment ? [] : ["equipment"]),
      ],
    },
    speciesName: selectedSpecies.name,
    className: CLASSES[data.classKey].label,
  };
  if (startingDefense) {
    if (
      !classDecision ||
      result.decision.pending.length ||
      (data.classKey === "rogue" && !classDecision.expertiseGrants)
    )
      fail(
        422,
        "Completá las habilidades, la pericia y las elecciones del trasfondo antes de confirmar la protección inicial.",
      );
    result.decision.startingDefense = require("./starting-defense").decide(
      startingDefense,
      {
        classKey: data.classKey,
        speciesKey,
        finalScores,
        background: result.decision.background,
        classDecision,
      },
    );
    const character = {
      ...finalScores,
      level: 1,
      characterClass: result.className,
      race: result.speciesName,
    };
    character.gameData = require("./creation-state")(
      character,
      result.decision,
      { preview: true },
    );
    const sheet = require("./rules").sheet(character);
    const defense = result.decision.startingDefense;
    const armor = require("./starting-defense")
      .catalog()
      .armors.find((a) => a.key === defense.armorKey);
    result.startingStats = {
      hp: sheet.state.hp.max,
      ac: sheet.derived.ac,
      initiative: sheet.derived.initiative,
      speed: sheet.derived.speed,
      proficiency: sheet.derived.proficiency,
      armorLabel: armor.name,
      shield: defense.shield,
      copper: sheet.state.currency.copper,
      hpExplanation:
        "PV de clase y Constitución: " +
        defense.hp.base +
        (defense.hp.speciesBonus
          ? " + " + defense.hp.speciesBonus + " por especie"
          : ""),
      acExplanation:
        sheet.derived.acExplanation ||
        "Según la protección equipada y tus atributos.",
      warnings: [
        "Las estadísticas y los recursos iniciales quedan listos. Los conjuros de clase, armas y otros rasgos que todavía no se eligen en este asistente deben completarse aparte.",
      ],
    };
  }
  return result;
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
