const { test } = require("node:test");
const assert = require("node:assert/strict");
const backgrounds = require("../src/game/backgrounds");
const rules = require("../src/game/rules");
const abilities = (values) =>
  Object.fromEntries(rules.ABILITIES.map((k, i) => [k, values[i]]));
function input() {
  return {
    version: 1,
    ruleset: "srd-2024",
    speciesKey: require("../src/game/data/species-2024.json").results.find(
      (s) => !s.is_subspecies,
    ).key,
    classKey: "wizard",
    method: "standard",
    baseScores: abilities([8, 14, 13, 15, 12, 10]),
    background: {
      key: "srd-2024_sage",
      increases: abilities([0, 0, 1, 2, 0, 0]),
    },
  };
}
test("Background boosts preserve the base and give the same result on repeated previews", () => {
  const data = input(),
    copy = structuredClone(data),
    a = backgrounds.preview(data),
    b = backgrounds.preview(data);
  assert.deepEqual(a, b);
  assert.deepEqual(data, copy);
  assert.equal(a.finalScores.intelligence, 17);
  assert.equal(a.modifiers.intelligence, 3);
  assert.equal(a.finalScores.constitution, 14);
  data.background.increases = abilities([0, 0, 1, 1, 1, 0]);
  assert.equal(backgrounds.preview(data).finalScores.wisdom, 13);
});
test("Reject illegal abilities, patterns, rolls, metadata, and unused purchase points", () => {
  for (const boost of [
    [2, 0, 0, 1, 0, 0],
    [0, 0, 0, 2, 0, 0],
    [0, 0, 2, 2, 0, 0],
    [0, 0, 0, 3, 0, 0],
  ]) {
    const d = input();
    d.background.increases = abilities(boost);
    assert.throws(() => backgrounds.preview(d));
  }
  for (const change of [
    { speciesKey: "missing" },
    { version: 2 },
    { extra: 1 },
    { method: "rolled" },
    { method: "pointBuy", baseScores: abilities([8, 8, 8, 8, 8, 8]) },
  ])
    assert.throws(() => backgrounds.preview({ ...input(), ...change }));
  const forged = input();
  forged.background.skillGrants = ["perception"];
  assert.throws(() => backgrounds.preview(forged));
  const d = input();
  d.background.key = "2014_sage";
  assert.throws(() => backgrounds.preview(d));
});
test("All supported backgrounds expose exactly their source abilities and benefits", () => {
  const entries = backgrounds.catalog();
  assert.equal(entries.length, 4);
  for (const b of entries) {
    assert.equal(new Set(b.abilities).size, 3);
    assert.ok(b.abilities.every((k) => rules.ABILITIES.includes(k)));
    assert.ok(b.feat && b.tools && b.equipment && b.skills && b.source);
    assert.deepEqual(
      b.skillGrants.map((k) => k.toLowerCase()),
      b.skills.split(" and ").map((s) => s.replaceAll(" ", "").toLowerCase()),
    );
  }
  assert.deepEqual(entries.find((b) => b.key === "srd-2024_sage").abilities, [
    "constitution",
    "intelligence",
    "wisdom",
  ]);
});
test("Tracked creation validates scalar consistency and sheet reads do not apply boosts twice or refill resources", () => {
  const d = input(),
    p = backgrounds.preview(d),
    c = {
      ...p.finalScores,
      name: "Ada",
      race: p.speciesName,
      characterClass: "Mago",
      level: 1,
      stateVersion: 0,
    };
  const decision = backgrounds.forCharacter(d, c);
  c.gameData = { ...rules.initial(c), creation: decision };
  c.gameData.hp = { max: 9, current: 2, temp: 0 };
  c.gameData.slotsSpent = { 1: 1 };
  const before = structuredClone(c),
    sheet = rules.sheet(c);
  assert.equal(sheet.derived.abilities[3].score, 17);
  assert.deepEqual(sheet.derived.abilities[3].breakdown, {
    base: 15,
    background: 2,
    permanent: 17,
    reduction: 0,
    total: 17,
  });
  assert.deepEqual(c, before);
  assert.equal(rules.sheet(c).state.hp.current, 2);
  assert.deepEqual(rules.sheet(c).state.slotsSpent, { 1: 1 });
  assert.throws(() => backgrounds.forCharacter(d, { ...c, intelligence: 19 }));
  assert.throws(() => backgrounds.forCharacter(d, { ...c, level: 2 }));
  assert.throws(() =>
    backgrounds.forCharacter(d, { ...c, characterClass: "Bardo" }),
  );
  c.gameData.abilityReductions = { intelligence: 2 };
  assert.equal(rules.sheet(c).derived.abilities[3].score, 15);
  assert.equal(c.intelligence, 17);
  const legacy = { ...c, gameData: rules.initial(c) };
  assert.equal(rules.sheet(legacy).derived.abilities[3].breakdown, undefined);
  assert.equal(rules.sheet(legacy).derived.abilities[3].score, 17);
});

test("Background skill grants stack by rank, survive configuration, and leave legacy sheets unchanged", () => {
  const d = input(),
    p = backgrounds.preview(d);
  const c = { ...p.finalScores, characterClass: "Mago", level: 1 };
  c.gameData = {
    ...rules.initial(c),
    creation: backgrounds.forCharacter(d, { ...c, race: p.speciesName }),
  };
  const skill = (key) =>
    rules.sheet(c).derived.skills.find((s) => s.key === key);
  assert.equal(skill("arcana").rank, 1);
  assert.equal(skill("arcana").modifier, 5);
  assert.equal(skill("arcana").configuredRank, 0);
  assert.equal(skill("arcana").backgroundSource, "Sabio");
  c.gameData.skills.arcana = 1;
  assert.equal(skill("arcana").modifier, 5);
  c.gameData.skills.arcana = 2;
  assert.equal(skill("arcana").modifier, 7);
  const data = {
    classes: [{ key: "wizard", level: 1 }],
    hp: { current: 5, max: 7, temp: 0 },
    xp: 0,
    speed: 30,
    armor: c.gameData.armor,
    skills: {},
    saveProficiencies: [],
    resources: [],
    features: [],
  };
  c.gameData = rules.apply(c, { type: "configure", data }).state;
  assert.equal(skill("arcana").rank, 1);
  assert.deepEqual(c.gameData.creation.background.skillGrants, [
    "arcana",
    "history",
  ]);
  const rolled = rules.apply(
    c,
    { type: "roll", data: { kind: "skill", key: "arcana" } },
    () => 10,
  );
  assert.equal(rolled.result.total, 15);
  assert.equal(c.gameData.hp.current, 5);
  delete c.gameData.creation.background.skillGrants;
  c.gameData.creation.pending.push("skills");
  assert.equal(skill("arcana").rank, 0);
  assert.equal(skill("arcana").backgroundRank, 0);
  assert.ok(
    rules
      .sheet(c)
      .completeness.warnings.some((s) =>
        s.includes("competencias de habilidad"),
      ),
  );
});

test("Tool proficiency uses its verified ability and applies to tool rolls", () => {
  const d = input(),
    p = backgrounds.preview(d),
    c = {
      ...p.finalScores,
      characterClass: "Mago",
      level: 1,
      race: p.speciesName,
    };
  c.gameData = {
    ...rules.initial(c),
    creation: backgrounds.forCharacter(d, c),
    configured: true,
  };
  const tool = rules.sheet(c).derived.tools[0];
  assert.equal(tool.key, "calligrapher");
  assert.equal(tool.modifier, 4);
  assert.equal(
    rules.apply(
      c,
      { type: "roll", data: { kind: "tool", key: "calligrapher" } },
      () => 10,
    ).result.total,
    14,
  );
  assert.throws(() =>
    rules.apply(
      c,
      { type: "roll", data: { kind: "tool", key: "thieves" } },
      () => 10,
    ),
  );
});
