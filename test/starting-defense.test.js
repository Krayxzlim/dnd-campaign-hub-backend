const { test } = require("node:test");
const assert = require("node:assert/strict");
const defense = require("../src/game/starting-defense");
const rules = require("../src/game/rules");
const schema = require("../src/game/schema");
const classes = require("../src/game/data/classes-2024.json").results;
function fixture(
  key = "wizard",
  speciesKey = "srd-2024_elf",
  armorKey = "none",
  shield = false,
) {
  const c = {
    level: 1,
    characterClass: rules.CLASSES[key].label,
    strength: 10,
    dexterity: 16,
    constitution: 14,
    intelligence: 15,
    wisdom: 14,
    charisma: 8,
  };
  const creation = {
    classKey: key,
    speciesKey,
    finalScores: { ...c },
    baseScores: { ...c },
    background: {
      name: "Sabio",
      increases: {},
      startingEquipment: { copper: 800 },
    },
    pending: [],
  };
  creation.startingDefense = defense.decide({ armorKey, shield }, creation);
  c.gameData = { ...defense.initialize(creation, rules.initial(c)), creation };
  return c;
}
test("Initial class money matches all twelve Core Traits tables and armor catalog preserves SRD prices", () => {
  const catalog = defense.catalog();
  for (const [key, option] of Object.entries(catalog.classes)) {
    const text = classes
      .find((c) => c.key === "srd-2024_" + key)
      .features.find((f) => f.feature_type === "CORE_TRAITS_TABLE").desc;
    assert.ok(text.includes(`(${option.goldOption}) ${option.gold} GP`), key);
    const c = fixture(key);
    assert.equal(c.gameData.currency.copper, option.gold * 100 + 800);
    assert.equal(c.gameData.hp.current, rules.CLASSES[key].die + 2);
    assert.equal(c.gameData.configured, true);
  }
  assert.deepEqual(
    catalog.armors
      .filter((a) => a.category !== "none")
      .map((a) => [a.key, a.costCopper]),
    [
      ["padded", 500],
      ["leather", 1000],
      ["studdedLeather", 4500],
      ["hide", 1000],
      ["chainShirt", 5000],
      ["scaleMail", 5000],
      ["breastplate", 40000],
      ["halfPlate", 75000],
      ["ringMail", 3000],
      ["chainMail", 7500],
      ["splint", 20000],
      ["plate", 150000],
    ],
  );
  assert.equal(catalog.shieldCostCopper, 1000);
});
test("Creation buys and equips legal protection once, rejects training and insufficient gold", () => {
  const c = fixture("fighter", "srd-2024_goliath", "chainMail", true);
  assert.equal(c.gameData.currency.copper, 7800);
  assert.equal(c.gameData.inventory.length, 2);
  for (const item of c.gameData.inventory)
    assert.doesNotThrow(() =>
      schema.operation.parse({
        type: "inventory",
        data: { operation: "upsert", item },
      }),
    );
  assert.equal(rules.sheet(c).derived.ac, 18);
  assert.equal(rules.sheet(c).derived.speed, 25);
  c.strength = 13;
  assert.equal(rules.sheet(c).derived.speed, 35);
  c.gameData.abilityReductions = { strength: 2 };
  assert.equal(rules.sheet(c).derived.speed, 25);
  assert.throws(() => fixture("wizard", "srd-2024_elf", "leather"));
  assert.throws(() => fixture("wizard", "srd-2024_elf", "none", true));
  assert.throws(() => fixture("fighter", "srd-2024_elf", "plate"));
  assert.throws(() => fixture("fighter", "srd-2024_elf", "notArmor"));
});
test("Unarmored defense recalculates from current abilities, equipment and shields", () => {
  const barbarian = fixture("barbarian", "srd-2024_elf", "none", true);
  assert.equal(rules.sheet(barbarian).derived.ac, 17);
  barbarian.gameData.abilityReductions = { constitution: 2 };
  assert.equal(rules.sheet(barbarian).derived.ac, 16);
  barbarian.gameData.inventory.push({
    type: "armor",
    equipped: true,
    quantity: 1,
    name: "Cuero",
    armor: { base: 11, dexterity: true, dexCap: 99, shield: 0, bonus: 0 },
  });
  assert.equal(rules.sheet(barbarian).derived.ac, 16);
  const monk = fixture("monk");
  assert.equal(rules.sheet(monk).derived.ac, 15);
  monk.gameData.inventory.push({ type: "shield", equipped: true, quantity: 1 });
  assert.equal(rules.sheet(monk).derived.ac, 15); // 10+DEX+shield, no WIS
  monk.wisdom = 18;
  assert.equal(rules.sheet(monk).derived.ac, 15);
  monk.gameData.inventory[0].equipped = false;
  assert.equal(rules.sheet(monk).derived.ac, 17);
  monk.gameData.abilityReductions = { wisdom: 2 };
  assert.equal(rules.sheet(monk).derived.ac, 16);
  delete monk.gameData.creation.startingDefense;
  assert.equal(rules.sheet(monk).derived.ac, 13); // legacy formula unchanged
});
test("Dwarf HP, preview and reads preserve depleted state without granting resources again", () => {
  const dwarf = fixture("wizard", "srd-2024_dwarf");
  assert.equal(dwarf.gameData.hp.max, 9);
  assert.equal(dwarf.gameData.hp.baseMax, 9);
  dwarf.gameData.hp.current = 3;
  dwarf.gameData.currency.copper = 1;
  dwarf.gameData.slotsSpent = { 1: 1 };
  const before = structuredClone(dwarf);
  assert.equal(rules.sheet(dwarf).state.hp.current, 3);
  assert.equal(rules.sheet(dwarf).derived.currency.copper, 1);
  assert.deepEqual(dwarf, before);
  const fighter = fixture("fighter", "srd-2024_dwarf", "chainMail", true);
  const decision = fighter.gameData.creation,
    initial = rules.initial(fighter),
    copy = structuredClone(initial);
  assert.deepEqual(
    defense.initialize(decision, initial, { preview: true }),
    defense.initialize(decision, initial, { preview: true }),
  );
  assert.deepEqual(initial, copy);
  const legacy = rules.initial(dwarf);
  assert.deepEqual(defense.initialize({}, legacy), legacy);
});
