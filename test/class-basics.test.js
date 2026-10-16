const { test } = require("node:test");
const assert = require("node:assert/strict");
const basics = require("../src/game/class-basics");
const rules = require("../src/game/rules");
const snapshot = require("../src/game/data/classes-2024.json").results;
test("Initial class basics agree with all twelve SRD class snapshots", () => {
  for (const key of Object.keys(rules.CLASSES)) {
    const row = snapshot.find((c) => c.key === "srd-2024_" + key);
    for (const constitution of [3, 8, 10, 14, 20]) {
      const b = basics.decide(key, { constitution });
      assert.equal(b.hitDie, Number(row.hit_dice.slice(1)));
      assert.equal(
        b.baseHitPoints,
        Math.max(1, b.hitDie + Math.floor((constitution - 10) / 2)),
      );
      assert.deepEqual(
        [...b.saveGrants].sort(),
        row.features
          .find((f) => f.feature_type === "CORE_TRAITS_TABLE")
          .desc.split("\n")
          .find((line) => line.includes("Saving Throw Proficiencies"))
          .split("|")[2]
          .toLowerCase()
          .split(" and ")
          .sort(),
      );
      assert.equal(
        basics.initialize({ classBasics: b }).hp.current,
        b.baseHitPoints,
      );
    }
  }
});
test("Granted saving throws survive configuration and reads never restore spent HP or slots", () => {
  const c = {
    characterClass: "Mago",
    level: 1,
    strength: 8,
    dexterity: 14,
    constitution: 14,
    intelligence: 17,
    wisdom: 12,
    charisma: 10,
  };
  const classBasics = basics.decide("wizard", c);
  c.gameData = {
    ...rules.initial(c),
    ...basics.initialize({ classBasics }),
    creation: {
      classKey: "wizard",
      classBasics,
      baseScores: { ...c },
      background: { increases: {} },
    },
  };
  c.gameData.hp.current = 2;
  c.gameData.slotsSpent = { 1: 1 };
  const before = structuredClone(c.gameData);
  const sheet = rules.sheet(c);
  assert.equal(
    sheet.derived.saves.find((s) => s.key === "intelligence").modifier,
    5,
  );
  assert.equal(
    sheet.derived.saves.find((s) => s.key === "intelligence").classProficient,
    true,
  );
  assert.deepEqual(c.gameData, before);
  const data = {
    classes: [{ key: "wizard", level: 1 }],
    hp: { ...c.gameData.hp },
    xp: 0,
    speed: 30,
    armor: c.gameData.armor,
    skills: {},
    saveProficiencies: ["intelligence"],
    resources: [],
    features: [],
  };
  c.gameData = rules.apply(c, { type: "configure", data }).state;
  assert.equal(
    rules.sheet(c).derived.saves.find((s) => s.key === "intelligence").modifier,
    5,
  );
  assert.equal(c.gameData.hp.current, 2);
  assert.equal(c.gameData.slotsSpent[1], 1);
  const rolled = rules.apply(
    c,
    { type: "roll", data: { kind: "save", key: "intelligence" } },
    () => 10,
  );
  assert.equal(rolled.result.total, 15);
  delete c.gameData.creation;
  c.gameData.saveProficiencies = [];
  assert.equal(
    rules.sheet(c).derived.saves.find((s) => s.key === "intelligence").modifier,
    3,
  );
});
