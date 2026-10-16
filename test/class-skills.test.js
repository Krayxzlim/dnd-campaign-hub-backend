const { test } = require("node:test");
const assert = require("node:assert/strict");
const skills = require("../src/game/class-skills");
const rules = require("../src/game/rules");
const backgrounds = require("../src/game/backgrounds");
test("All twelve classes expose supported skills and reject wrong counts, duplicates and foreign choices", () => {
  for (const key of Object.keys(rules.CLASSES)) {
    const d = skills.definition(key);
    assert.ok(d.count >= 2 && d.count <= 4);
    assert.ok(d.options.every((k) => rules.SKILLS.some((s) => s[0] === k)));
    const choices = d.options.slice(0, d.count);
    assert.deepEqual(skills.decide(key, choices).skillGrants, choices);
    assert.throws(() => skills.decide(key, choices.slice(1)));
    assert.throws(() => skills.decide(key, Array(d.count).fill(choices[0])));
    assert.throws(() => skills.decide(key, [...choices.slice(1), "unknown"]));
    assert.equal(skills.decide(key, undefined), null);
  }
  assert.equal(skills.definition("bard").options.length, 18);
  assert.equal(skills.definition("rogue").count, 4);
});
test("Creation preserves class skill provenance and does not duplicate background or manual proficiency", () => {
  const values = (n) =>
    Object.fromEntries(rules.ABILITIES.map((k, i) => [k, n[i]]));
  const input = {
    version: 1,
    ruleset: "srd-2024",
    speciesKey: require("../src/game/data/species-2024.json").results.find(
      (s) => !s.is_subspecies,
    ).key,
    classKey: "wizard",
    method: "standard",
    baseScores: values([8, 14, 13, 15, 12, 10]),
    classSkills: ["arcana", "investigation"],
    background: { key: "srd-2024_sage", increases: values([0, 0, 1, 2, 0, 0]) },
  };
  const copy = structuredClone(input),
    preview = backgrounds.preview(input);
  assert.deepEqual(input, copy);
  const c = { ...preview.finalScores, characterClass: "Mago", level: 1 };
  c.gameData = { ...rules.initial(c), creation: preview.decision };
  const skill = (k) => rules.sheet(c).derived.skills.find((s) => s.key === k);
  assert.equal(skill("arcana").modifier, 5);
  assert.equal(skill("arcana").classRank, 1);
  assert.equal(skill("arcana").backgroundRank, 1);
  assert.equal(skill("investigation").classSource, "Mago");
  c.gameData.skills.investigation = 2;
  assert.equal(skill("investigation").modifier, 7);
  c.gameData.skills = {};
  assert.equal(skill("investigation").modifier, 5);
  delete c.gameData.creation.classDecision;
  assert.equal(skill("investigation").rank, 0);
  assert.equal(skill("arcana").rank, 1);
  assert.throws(() =>
    backgrounds.preview({ ...input, classSkills: ["athletics", "stealth"] }),
  );
});

test("Rogue expertise requires two distinct granted skills and doubles proficiency only once", () => {
  const values = (n) =>
    Object.fromEntries(rules.ABILITIES.map((k, i) => [k, n[i]]));
  const input = {
    version: 1,
    ruleset: "srd-2024",
    speciesKey: require("../src/game/data/species-2024.json").results.find(
      (s) => !s.is_subspecies,
    ).key,
    classKey: "rogue",
    method: "standard",
    baseScores: values([8, 14, 13, 15, 12, 10]),
    classSkills: ["stealth", "investigation", "perception", "acrobatics"],
    expertise: ["stealth", "arcana"],
    background: { key: "srd-2024_sage", increases: values([0, 0, 1, 2, 0, 0]) },
  };
  const p = backgrounds.preview(input);
  assert.deepEqual(p.decision.classDecision.expertiseGrants, [
    "stealth",
    "arcana",
  ]);
  const c = { ...p.finalScores, characterClass: "Pícaro", level: 1 };
  c.gameData = { ...rules.initial(c), creation: p.decision, configured: true };
  const rank = (k) => rules.sheet(c).derived.skills.find((s) => s.key === k);
  assert.equal(rank("stealth").modifier, 6);
  assert.equal(rank("arcana").modifier, 7);
  c.gameData.skills.arcana = 2;
  assert.equal(rank("arcana").modifier, 7);
  c.gameData.skills = {};
  assert.equal(rank("arcana").rank, 2);
  assert.equal(
    rules.apply(
      c,
      { type: "roll", data: { kind: "skill", key: "arcana" } },
      () => 10,
    ).result.total,
    17,
  );
  for (const expertise of [
    ["stealth"],
    ["stealth", "stealth"],
    ["stealth", "athletics"],
    ["stealth", "unknown"],
  ])
    assert.throws(() => backgrounds.preview({ ...input, expertise }));
  assert.throws(() =>
    backgrounds.preview({ ...input, classSkills: undefined }),
  );
  assert.throws(() =>
    backgrounds.preview({
      ...input,
      classKey: "wizard",
      classSkills: ["arcana", "history"],
    }),
  );
  const legacy = backgrounds.preview({ ...input, expertise: undefined });
  assert.equal(legacy.decision.classDecision.expertiseGrants, undefined);
});
