const { test } = require("node:test");
const assert = require("node:assert/strict");
const feats = require("../src/game/origin-feats");
const rules = require("../src/game/rules");
const schema = require("../src/game/schema");
const choice = {
  castingAbility: "charisma",
  cantrips: ["srd-2024-fire-bolt", "srd-2024-light"],
  spell: "srd-2024-shield",
};
// Keys are checked against the committed SRD snapshot, never hand-entered spell descriptions.
const wizard = feats.catalog().filter((s) => s.lists.includes("wizard"));
choice.cantrips = wizard
  .filter((s) => s.level === 0)
  .slice(0, 2)
  .map((s) => s.key);
choice.spell = wizard.find(
  (s) => s.level === 1 && !s.concentration && !s.ritual,
).key;
function character(feat) {
  const c = {
    level: 1,
    characterClass: "Guerrero",
    strength: 14,
    dexterity: 12,
    constitution: 13,
    intelligence: 10,
    wisdom: 8,
    charisma: 16,
  };
  const decision = {
    classKey: "fighter",
    baseScores: Object.fromEntries(rules.ABILITIES.map((k) => [k, c[k]])),
    background: {
      name: "Prueba",
      increases: Object.fromEntries(rules.ABILITIES.map((k) => [k, 0])),
      originFeat: feat,
    },
    pending: [],
  };
  c.gameData = {
    ...rules.initial(c),
    ...feats.initialize(decision),
    creation: decision,
    configured: true,
    hp: { current: 4, max: 10, temp: 0 },
  };
  return c;
}
test("Magic Initiate validates lists, levels, ability and unique choices", () => {
  const feat = feats.decide("srd-2024_sage", choice);
  assert.equal(feat.spells.length, 3);
  assert.equal(feat.castingAbility, "charisma");
  assert.equal(feat.list, "wizard");
  assert.throws(() =>
    feats.decide("srd-2024_sage", {
      ...choice,
      cantrips: [choice.cantrips[0], choice.cantrips[0]],
    }),
  );
  assert.throws(() =>
    feats.decide("srd-2024_sage", { ...choice, spell: choice.cantrips[0] }),
  );
  const onlyCleric = feats
    .catalog()
    .find(
      (s) =>
        s.level === 1 &&
        s.lists.includes("cleric") &&
        !s.lists.includes("wizard"),
    );
  assert.throws(() =>
    feats.decide("srd-2024_sage", { ...choice, spell: onlyCleric.key }),
  );
  assert.throws(() => feats.decide("srd-2024_criminal", choice));
});
test("Magic Initiate works for a noncaster, keeps grants immutable, and restores free casting only on a completed long rest", () => {
  const c = character(feats.decide("srd-2024_sage", choice));
  const grant = c.gameData.spells.find((s) => s.level === 1),
    cantrip = c.gameData.spells.find((s) => s.level === 0);
  const caster = rules
    .sheet(c)
    .derived.spellcasting.find((x) => x.origin === "magicInitiate");
  assert.equal(caster.ability, "charisma");
  assert.equal(caster.dc, 13);
  assert.equal(caster.attack, 5);
  const free = {
    type: "cast",
    data: { id: grant.id, slotLevel: 0, originFeatUse: true },
  };
  c.gameData = rules.apply(c, free).state;
  assert.equal(rules.sheet(c).derived.originFeat.freeCastRemaining, 0);
  assert.throws(() => rules.apply(c, free));
  assert.equal(rules.sheet(c).state.hp.current, 4);
  assert.deepEqual(c.gameData.slotsSpent, {});
  assert.throws(() =>
    rules.apply(c, {
      type: "spell",
      data: { operation: "remove", id: grant.id },
    }),
  );
  assert.throws(() =>
    rules.apply(c, {
      type: "spell",
      data: { operation: "upsert", spell: { ...grant, prepared: false } },
    }),
  );
  assert.doesNotThrow(() =>
    rules.apply(c, { type: "cast", data: { id: cantrip.id, slotLevel: 0 } }),
  );
  c.gameData = rules.apply(c, {
    type: "rest",
    data: { kind: "short", hours: 1, worldHour: 1 },
  }).state;
  assert.throws(() => rules.apply(c, free));
  c.gameData = rules.apply(c, {
    type: "rest",
    data: { kind: "long", hours: 1, worldHour: 3, interrupted: true },
  }).state;
  assert.throws(() => rules.apply(c, free));
  assert.throws(() =>
    rules.apply(c, {
      type: "rest",
      data: { kind: "long", hours: 7, worldHour: 8 },
    }),
  );
  c.gameData = rules.apply(c, {
    type: "rest",
    data: { kind: "long", hours: 8, worldHour: 8 },
  }).state;
  assert.equal(rules.sheet(c).derived.originFeat.freeCastRemaining, 1);
  assert.doesNotThrow(() => rules.apply(c, free));
});
test("Alert adds proficiency once to initiative and rolls use that same derived modifier", () => {
  const c = character(feats.decide("srd-2024_criminal"));
  assert.equal(rules.sheet(c).derived.initiative, 3);
  assert.equal(
    rules.apply(c, { type: "roll", data: { kind: "initiative" } }, () => 10)
      .result.total,
    13,
  );
  c.gameData.exhaustion = 1;
  assert.equal(rules.sheet(c).derived.initiative, 1);
  delete c.gameData.creation.background.originFeat;
  assert.equal(rules.sheet(c).derived.initiative, -1);
});
test("Savage Attacker rolls only weapon dice once per declared turn and requires an equipped weapon", () => {
  const c = character(feats.decide("srd-2024_soldier"));
  c.gameData.inventory = [
    {
      id: "weapon",
      name: "Spear",
      type: "weapon",
      equipped: true,
      quantity: 1,
      damage: "1d6",
      bonus: 0,
    },
  ];
  const attack = {
    type: "savageAttacker",
    data: { weaponId: "weapon", critical: false },
  };
  assert.throws(() => rules.apply(c, attack));
  c.gameData = rules.apply(c, { type: "beginTurn", data: {} }).state;
  let n = 0;
  const result = rules.apply(c, attack, () => ++n);
  assert.deepEqual(result.result.sets, [[1], [2]]);
  assert.deepEqual(result.result.totals, [1, 2]);
  assert.equal(result.result.recommended, 1);
  c.gameData = result.state;
  assert.throws(() => rules.apply(c, attack));
  assert.equal(rules.sheet(c).derived.originFeat.availableThisTurn, false);
  c.gameData = rules.apply(c, { type: "beginTurn", data: {} }).state;
  assert.equal(
    rules.apply(
      c,
      { ...attack, data: { ...attack.data, critical: true } },
      () => 3,
    ).result.sets[0].length,
    2,
  );
  c.gameData.inventory[0].equipped = false;
  assert.throws(() => rules.apply(c, attack));
  assert.throws(() =>
    rules.apply(character(feats.decide("srd-2024_criminal")), {
      type: "beginTurn",
      data: {},
    }),
  );
});
