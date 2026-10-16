const { randomUUID } = require("node:crypto");
const { fail } = require("../lib/http");
const tools = {
  calligrapher: {
    key: "calligrapher",
    name: "Útiles de caligrafía",
    ability: "dexterity",
  },
  thieves: {
    key: "thieves",
    name: "Herramientas de ladrón",
    ability: "dexterity",
  },
  dice: { key: "dice", name: "Juego de dados", ability: "wisdom" },
  dragonchess: {
    key: "dragonchess",
    name: "Ajedrez dragón",
    ability: "wisdom",
  },
  cards: { key: "cards", name: "Naipes", ability: "wisdom" },
  threeDragonAnte: {
    key: "threeDragonAnte",
    name: "Ante de tres dragones",
    ability: "wisdom",
  },
};
const gear = (name, quantity = 1) => ({ name, quantity, type: "gear" });
const weapon = (name, damage, extra = {}) => ({
  name,
  quantity: 1,
  type: "weapon",
  damage,
  ...extra,
});
const packages = {
  "srd-2024_acolyte": {
    tool: "calligrapher",
    gold: 8,
    items: [
      gear("Calligrapher's Supplies"),
      gear("Book (prayers)"),
      gear("Holy Symbol"),
      gear("Parchment", 10),
      gear("Robe"),
    ],
  },
  "srd-2024_criminal": {
    tool: "thieves",
    gold: 16,
    items: [
      weapon("Dagger", "1d4", {
        quantity: 2,
        finesse: true,
        range: "5 ft · thrown 20/60 ft",
        notes: "Piercing · Finesse, Light, Thrown",
      }),
      gear("Thieves' Tools"),
      gear("Crowbar"),
      gear("Pouch", 2),
      gear("Traveler's Clothes"),
    ],
  },
  "srd-2024_sage": {
    tool: "calligrapher",
    gold: 8,
    items: [
      weapon("Quarterstaff", "1d6", { notes: "Bludgeoning · Versatile (1d8)" }),
      gear("Calligrapher's Supplies"),
      gear("Book (history)"),
      gear("Parchment", 8),
      gear("Robe"),
    ],
  },
  "srd-2024_soldier": {
    choices: ["dice", "dragonchess", "cards", "threeDragonAnte"],
    gold: 14,
    items: [
      weapon("Spear", "1d6", {
        range: "5 ft · thrown 20/60 ft",
        notes: "Piercing · Thrown, Versatile (1d8)",
      }),
      weapon("Shortbow", "1d6", {
        ranged: true,
        range: "80/320 ft",
        notes: "Piercing · Ammunition (Arrow), Two-Handed",
      }),
      gear("Arrow", 20),
      gear("Gaming Set"),
      gear("Healer's Kit"),
      gear("Quiver"),
      gear("Traveler's Clothes"),
    ],
  },
};
function options(key) {
  const p = packages[key];
  return {
    equipmentOptions: [
      {
        key: "A",
        name: "Paquete de equipo",
        gold: p.gold,
        items: structuredClone(p.items),
      },
      { key: "B", name: "50 piezas de oro", gold: 50, items: [] },
    ],
    toolOptions: (p.choices || [p.tool]).map((k) => ({ ...tools[k] })),
    toolChoiceRequired: !!p.choices,
  };
}
function decide(key, choice) {
  const p = packages[key];
  if (choice.toolChoice && !(p.choices || [p.tool]).includes(choice.toolChoice))
    fail(422, "La herramienta no pertenece a este trasfondo.");
  if (choice.equipmentOption && p.choices && !choice.toolChoice)
    fail(422, "Elegí tu juego antes de confirmar el equipo.");
  const toolKey = choice.toolChoice || p.tool;
  const toolProficiencies = toolKey ? [{ ...tools[toolKey] }] : [];
  if (!choice.equipmentOption) return { toolProficiencies };
  const option = options(key).equipmentOptions.find(
    (o) => o.key === choice.equipmentOption,
  );
  const items = option.items.map((item) => ({
    ...item,
    name: item.name === "Gaming Set" ? tools[toolKey].name : item.name,
  }));
  return {
    toolProficiencies,
    startingEquipment: { option: option.key, copper: option.gold * 100, items },
  };
}
function initialize(decision) {
  const equipment = decision.background.startingEquipment;
  if (!equipment) return {};
  return {
    currency: { copper: equipment.copper },
    inventory: equipment.items.map((item) => ({
      id: randomUUID(),
      equipped: false,
      proficient: false,
      finesse: false,
      ranged: false,
      damage: "1d4",
      range: "5 ft",
      bonus: 0,
      ...item,
      notes: [item.notes, `Trasfondo: ${decision.background.name} · SRD 2024`]
        .filter(Boolean)
        .join(" · "),
    })),
  };
}
module.exports = { options, decide, initialize };
