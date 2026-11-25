const { randomUUID } = require("node:crypto");
const { fail } = require("../lib/http");
const { CLASSES, mod } = require("./rules");
// SRD 5.2, Open5e: data/raw_sources/srd_5_2/sections/07_armor_items.md.
const armorSource = "Open5e · SRD 2024 · 07_armor_items";
const armorRows = [
  ["none", "Sin armadura", "none", 0, 10, true, 99, 0, false],
  ["padded", "Acolchada", "light", 5, 11, true, 99, 0, true],
  ["leather", "Cuero", "light", 10, 11, true, 99, 0, false],
  ["studdedLeather", "Cuero tachonado", "light", 45, 12, true, 99, 0, false],
  ["hide", "Pieles", "medium", 10, 12, true, 2, 0, false],
  ["chainShirt", "Camisote de malla", "medium", 50, 13, true, 2, 0, false],
  ["scaleMail", "Cota de escamas", "medium", 50, 14, true, 2, 0, true],
  ["breastplate", "Coraza", "medium", 400, 14, true, 2, 0, false],
  ["halfPlate", "Semiplacas", "medium", 750, 15, true, 2, 0, true],
  ["ringMail", "Cota de anillas", "heavy", 30, 14, false, 99, 0, true],
  ["chainMail", "Cota de malla", "heavy", 75, 16, false, 99, 13, true],
  ["splint", "Bandas", "heavy", 200, 17, false, 99, 15, true],
  ["plate", "Placas", "heavy", 1500, 18, false, 99, 15, true],
];
// Gold alternatives and baseline armor training from the committed Core Traits tables.
const classRows = {
  barbarian: [75, ["light", "medium"], true],
  bard: [90, ["light"], false],
  cleric: [110, ["light", "medium"], true],
  druid: [50, ["light"], true],
  fighter: [155, ["light", "medium", "heavy"], true],
  monk: [50, [], false],
  paladin: [150, ["light", "medium", "heavy"], true],
  ranger: [150, ["light", "medium"], true],
  rogue: [100, ["light"], false],
  sorcerer: [50, [], false],
  warlock: [100, ["light"], false],
  wizard: [55, [], false],
};
function catalog() {
  return {
    armors: armorRows.map(
      ([
        key,
        name,
        category,
        gp,
        base,
        dexterity,
        dexCap,
        strength,
        stealthDisadvantage,
      ]) => ({
        key,
        name,
        category,
        costCopper: gp * 100,
        base,
        dexterity,
        dexCap,
        strength,
        stealthDisadvantage,
        source: armorSource,
      }),
    ),
    shieldCostCopper: 1000,
    classes: Object.fromEntries(
      Object.entries(classRows).map(([key, [gold, armorTypes, shield]]) => [
        key,
        {
          gold,
          armorTypes: [...armorTypes],
          shield,
          goldOption: key === "fighter" ? "C" : "B",
          source: `Open5e · SRD 2024 · srd-2024_${key}_core-traits`,
        },
      ]),
    ),
  };
}
function decide(data, context) {
  const { classKey, speciesKey, finalScores, background } = context;
  const options = catalog(),
    cl = options.classes[classKey];
  const armor = options.armors.find((a) => a.key === data.armorKey);
  if (!cl || !armor || typeof data.shield !== "boolean")
    fail(422, "Elegí una protección del catálogo.");
  if (armor.category !== "none" && !cl.armorTypes.includes(armor.category))
    fail(422, "Tu clase no tiene entrenamiento con esa armadura.");
  if (data.shield && !cl.shield)
    fail(422, "Tu clase no tiene entrenamiento con escudos.");
  const startingCopper =
    cl.gold * 100 + (background.startingEquipment?.copper || 0);
  const spentCopper = armor.costCopper + (data.shield ? 1000 : 0);
  if (spentCopper > startingCopper)
    fail(422, "No alcanza el oro inicial para esa protección.");
  const base = Math.max(
    1,
    CLASSES[classKey].die + mod(finalScores.constitution),
  );
  const speciesBonus = speciesKey === "srd-2024_dwarf" ? 1 : 0;
  const items = [];
  if (armor.key !== "none")
    items.push({
      name: armor.name,
      type: "armor",
      quantity: 1,
      equipped: true,
      proficient: true,
      armor: {
        base: armor.base,
        dexterity: armor.dexterity,
        dexCap: armor.dexCap,
        shield: 0,
        bonus: 0,
        strength: armor.strength,
      },
      notes:
        "Comprada con el oro inicial · " +
        armorSource +
        (armor.stealthDisadvantage ? " · Desventaja en Sigilo" : ""),
    });
  if (data.shield)
    items.push({
      name: "Escudo",
      type: "shield",
      quantity: 1,
      equipped: true,
      proficient: true,
      notes: "Comprado con el oro inicial · " + armorSource,
    });
  return {
    armorKey: armor.key,
    shield: data.shield,
    classGold: cl.gold,
    classGoldOption: cl.goldOption,
    startingCopper,
    spentCopper,
    remainingCopper: startingCopper - spentCopper,
    hp: { base, speciesBonus, max: base + speciesBonus },
    speed: speciesKey === "srd-2024_goliath" ? 35 : 30,
    items,
    source: cl.source,
  };
}
function initialize(decision, state, { preview = false } = {}) {
  const chosen = decision.startingDefense;
  if (!chosen) return state;
  return {
    ...state,
    configured: true,
    hp: {
      baseMax: chosen.hp.max,
      max: chosen.hp.max,
      current: chosen.hp.max,
      temp: 0,
    },
    speed: chosen.speed,
    currency: { copper: chosen.remainingCopper },
    inventory: [
      ...state.inventory,
      ...chosen.items.map((item, i) => ({
        id: preview
          ? `00000000-0000-4000-8000-00000000000${i + 1}`
          : randomUUID(),
        bonus: 0,
        finesse: false,
        ranged: false,
        damage: "1d4",
        range: "5 ft",
        ...item,
      })),
    ],
  };
}
module.exports = { catalog, decide, initialize };
