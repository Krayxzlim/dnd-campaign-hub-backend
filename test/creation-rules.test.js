const { test } = require("node:test");
const assert = require("node:assert/strict");
const { catalog, preview } = require("../src/game/creation-rules");
const { ABILITIES, CLASSES } = require("../src/game/rules");
const snapshot = require("../src/game/data/classes-2024.json").results;
const scores = (values) =>
  Object.fromEntries(ABILITIES.map((key, i) => [key, values[i]]));
const standard = {
  classKey: "wizard",
  method: "standard",
  baseScores: scores([15, 14, 13, 12, 10, 8]),
};
test("catalog covers every engine class and matches snapshot primary abilities, saves, hit dice and level-one features", () => {
  const data = catalog();
  assert.deepEqual(
    data.classes.map((c) => c.key),
    Object.keys(CLASSES),
  );
  for (const cl of data.classes) {
    const source = snapshot.find((c) => c.key === `srd-2024_${cl.key}`);
    const row = cl.coreTraits
      .match(/\|Primary Ability\|([^|]+)\|/)[1]
      .toLowerCase();
    assert.deepEqual(cl.primaryAbilities, row.split(/ and | or /));
    assert.deepEqual([...cl.recommendedOrder].sort(), [...ABILITIES].sort());
    assert.match(cl.coreTraits, new RegExp(`D${cl.hitDie} per`));
    assert.deepEqual(
      cl.savingThrows,
      cl.coreTraits
        .match(/\|Saving Throw Proficiencies\|([^|]+)\|/)[1]
        .toLowerCase()
        .split(" and "),
    );
    assert.deepEqual(
      cl.levelOneFeatures,
      source.features
        .filter(
          (f) =>
            f.feature_type === "CLASS_LEVEL_FEATURE" &&
            f.gained_at.some((g) => g.level === 1),
        )
        .map((f) => ({ name: f.name, description: f.desc })),
    );
    assert.match(cl.progressionSummary, /no resuelve la progresión/);
  }
  data.methods.standard.values[0] = 99;
  assert.equal(catalog().methods.standard.values[0], 15);
});
test("standard assignment preserves input and suggests optional class allocation", () => {
  const before = structuredClone(standard);
  const result = preview(standard);
  assert.deepEqual(standard, before);
  assert.equal(result.recommendedScores.intelligence, 15);
  assert.equal(result.modifiers.charisma, -1);
  assert.equal(result.scope, "base-abilities");
  assert.equal(result.pointsRemaining, undefined);
  assert.throws(() =>
    preview({ ...standard, baseScores: scores([15, 15, 13, 12, 10, 8]) }),
  );
});
test("point buy handles its nonlinear costs, unused budget and invalid assignments", () => {
  const input = {
    ...standard,
    method: "pointBuy",
    baseScores: scores([15, 15, 15, 8, 8, 8]),
  };
  assert.equal(preview(input).pointsRemaining, 0);
  const untouched = { ...input, baseScores: scores([8, 8, 8, 8, 8, 8]) };
  assert.equal(preview(untouched).pointsRemaining, 27);
  assert.equal(preview(untouched).recommendedScores.intelligence, 15);
  assert.equal(untouched.baseScores.intelligence, 8);
  for (const pool of [
    [15, 15, 15, 9, 8, 8],
    [16, 8, 8, 8, 8, 8],
    [7, 8, 8, 8, 8, 8],
  ])
    assert.throws(() => preview({ ...input, baseScores: scores(pool) }));
});
test("rolled assignments must use exactly the six 4d6-drop-lowest results, including duplicates", () => {
  const rolls = [
    [1, 1, 1, 1],
    [6, 6, 6, 6],
    [1, 3, 4, 5],
    [1, 3, 4, 5],
    [2, 3, 4, 5],
    [1, 2, 3, 4],
  ];
  const input = {
    ...standard,
    method: "rolled",
    rolls,
    baseScores: scores([18, 3, 12, 12, 12, 9]),
  };
  const before = structuredClone(input);
  assert.equal(preview(input).modifiers.dexterity, -4);
  assert.deepEqual(input, before);
  assert.throws(() =>
    preview({ ...input, baseScores: scores([18, 3, 12, 12, 13, 9]) }),
  );
  for (const badRolls of [
    undefined,
    rolls.slice(1),
    [...rolls.slice(1), [7, 6, 6, 6]],
    [...rolls.slice(1), [1, 2, 3]],
    [...rolls.slice(1), [1, 2, 3, 4.5]],
  ])
    assert.throws(() => preview({ ...input, rolls: badRolls }));
});
test("strict preview rejects manual values, extra metadata, unknown classes and incomplete scores", () => {
  for (const extra of [
    { method: "manual" },
    { classKey: "unknown" },
    { level: 2 },
    { rolls: [] },
    { baseScores: { ...standard.baseScores, luck: 10 } },
    { baseScores: { strength: 15 } },
    { baseScores: { ...standard.baseScores, strength: "15" } },
  ])
    assert.throws(() => preview({ ...standard, ...extra }));
});
