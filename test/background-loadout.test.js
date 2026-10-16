const { test } = require("node:test");
const assert = require("node:assert/strict");
const loadout = require("../src/game/background-loadout");
const rules = require("../src/game/rules");
const schema = require("../src/game/schema");
test("Background packages grant exact quantities and money, with a matching selected gaming set", () => {
  const criminal = loadout.decide("srd-2024_criminal", {
    equipmentOption: "A",
  });
  assert.equal(criminal.startingEquipment.copper, 1600);
  assert.equal(
    criminal.startingEquipment.items.find((x) => x.name === "Dagger").quantity,
    2,
  );
  assert.equal(
    criminal.startingEquipment.items.find((x) => x.name === "Pouch").quantity,
    2,
  );
  assert.equal(criminal.toolProficiencies[0].ability, "dexterity");
  assert.throws(() =>
    loadout.decide("srd-2024_soldier", { equipmentOption: "A" }),
  );
  assert.throws(() =>
    loadout.decide("srd-2024_sage", {
      equipmentOption: "A",
      toolChoice: "dice",
    }),
  );
  const soldier = loadout.decide("srd-2024_soldier", {
    equipmentOption: "A",
    toolChoice: "cards",
  });
  assert.equal(soldier.startingEquipment.copper, 1400);
  assert.equal(
    soldier.startingEquipment.items.find((x) => x.name === "Arrow").quantity,
    20,
  );
  assert.ok(soldier.startingEquipment.items.some((x) => x.name === "Naipes"));
  assert.equal(soldier.toolProficiencies[0].key, "cards");
  for (const key of ["acolyte", "criminal", "sage", "soldier"]) {
    const choice = loadout.decide("srd-2024_" + key, {
      equipmentOption: "B",
      ...(key === "soldier" ? { toolChoice: "dice" } : {}),
    });
    assert.equal(choice.startingEquipment.copper, 5000);
    assert.equal(choice.startingEquipment.items.length, 0);
    assert.equal(choice.toolProficiencies.length, 1);
  }
});
test("Supplies are inserted once, weapon data fits the inventory contract, spending never refills on reads or rests", () => {
  const supplies = loadout.decide("srd-2024_sage", { equipmentOption: "A" });
  const creation = { background: { ...supplies, name: "Sabio" }, pending: [] };
  const c = {
    name: "A",
    characterClass: "Mago",
    level: 1,
    strength: 8,
    dexterity: 14,
    constitution: 13,
    intelligence: 17,
    wisdom: 12,
    charisma: 10,
  };
  // Test tool and inventory behavior without unrelated creation ability metadata.
  c.gameData = { ...rules.initial(c), ...loadout.initialize(creation) };
  assert.equal(c.gameData.inventory.length, 5);
  for (const item of c.gameData.inventory)
    assert.doesNotThrow(() =>
      schema.operation.parse({
        type: "inventory",
        data: { operation: "upsert", item },
      }),
    );
  assert.ok(
    c.gameData.inventory.every((item) => !item.equipped && !item.proficient),
  );
  c.gameData = rules.apply(c, {
    type: "money",
    data: { deltaCopper: -125 },
  }).state;
  assert.equal(c.gameData.currency.copper, 675);
  const before = structuredClone(c);
  assert.equal(rules.sheet(c).derived.currency.copper, 675);
  assert.deepEqual(c, before);
  assert.throws(() =>
    rules.apply(c, { type: "money", data: { deltaCopper: -676 } }),
  );
  c.gameData = rules.apply(c, {
    type: "inventory",
    data: { operation: "remove", id: c.gameData.inventory[0].id },
  }).state;
  assert.equal(rules.sheet(c).state.inventory.length, 4);
  const legacy = { ...c, gameData: rules.initial(c) };
  assert.equal(rules.sheet(legacy).derived.currency.copper, 0);
  assert.deepEqual(rules.sheet(legacy).derived.tools, []);
  assert.throws(() =>
    schema.operation.parse({ type: "money", data: { deltaCopper: 1.5 } }),
  );
});
