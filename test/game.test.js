const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const rules = require("../src/game/rules");
const { operation } = require("../src/game/schema");
function character(key = "wizard", level = 5) {
  const c = {
    id: randomUUID(),
    stateVersion: 0,
    level,
    characterClass: key,
    name: "Aster",
    race: "Elf",
    strength: 8,
    dexterity: 14,
    constitution: 14,
    intelligence: 18,
    wisdom: 12,
    charisma: 16,
  };
  const s = rules.initial(c);
  s.configured = true;
  s.hp = { current: 15, max: 30, temp: 5, baseMax: 30 };
  s.saveProficiencies = ["intelligence", "wisdom"];
  s.skills = { arcana: 2 };
  c.gameData = s;
  return c;
}
function run(c, type, data, die = () => 4) {
  const cmd = operation.parse({ type, data });
  const result = rules.apply(c, cmd, die);
  return { ...c, gameData: result.state, result: result.result };
}
test("derived values: odd negative ability, expertise, exhaustion and armor use declared data", () => {
  const c = character();
  assert.equal(rules.mod(9), -1);
  let d = rules.sheet(c).derived;
  assert.equal(d.proficiency, 3);
  assert.equal(d.saves[3].modifier, 7);
  assert.equal(d.skills.find((x) => x.key === "arcana").modifier, 10);
  assert.equal(d.ac, 12);
  c.gameData.exhaustion = 2;
  d = rules.sheet(c).derived;
  assert.equal(d.speed, 20);
  assert.equal(d.saves[3].modifier, 3);
  assert.equal(d.spellcasting[0].dc, 15);
  c.gameData.inventory = [{ type: "shield", equipped: true, quantity: 1 }];
  c.gameData.armor.shield = 2;
  assert.equal(rules.sheet(c).derived.ac, 14);
});
test("all twelve classes derive their hit dice; unknown classes are never silently wizards", () => {
  for (const key of Object.keys(rules.CLASSES)) {
    const c = character(key);
    assert.equal(rules.sheet(c).derived.hitDice[0].die, rules.CLASSES[key].die);
  }
  const c = character("Unknown");
  assert.equal(rules.sheet(c).derived.spellcasting.length, 0);
  assert.equal(rules.sheet(c).identity.level, 5);
});
test("slots separate Pact Magic and round each 2024 half caster upward; Extra Attack never stacks", () => {
  const c = character("wizard", 8);
  c.gameData.classes = [
    { key: "wizard", level: 3 },
    { key: "paladin", level: 3 },
    { key: "warlock", level: 2 },
  ];
  const slots = rules.sheet(c).derived.slots;
  assert.deepEqual(
    slots.map((x) => [x.level, x.max, x.pool || "standard"]),
    [
      [1, 4, "standard"],
      [2, 3, "standard"],
      [3, 2, "standard"],
      [1, 2, "pact"],
    ],
  );
  c.gameData.classes = [
    { key: "fighter", level: 5 },
    { key: "ranger", level: 5 },
  ];
  assert.equal(rules.sheet(c).derived.attacksPerAction, 2);
});
test("damage absorbs temporary HP, detects massive damage, and never heals beyond max", () => {
  let c = run(character(), "hp", { mode: "damage", amount: 9 });
  assert.deepEqual([c.gameData.hp.temp, c.gameData.hp.current], [0, 11]);
  c = run(c, "hp", { mode: "heal", amount: 100 });
  assert.equal(c.gameData.hp.current, 30);
  c = run(c, "hp", { mode: "damage", amount: 65 });
  assert.equal(c.gameData.death.failures, 3);
  assert.throws(() => run(c, "hp", { mode: "heal", amount: 1 }), /muerto/);
});
test("advantage and disadvantage cancel; death saves use total except natural 1 and 20", () => {
  let c = character();
  c.gameData.hp.current = 0;
  let calls = 0;
  c = run(
    c,
    "roll",
    { kind: "death", advantage: true, disadvantage: true, modifier: 2 },
    () => {
      calls++;
      return 8;
    },
  );
  assert.equal(calls, 1);
  assert.equal(c.gameData.death.successes, 1);
  c = run(c, "roll", { kind: "death" }, () => 1);
  assert.equal(c.gameData.death.failures, 2);
  c = run(c, "roll", { kind: "death" }, () => 20);
  assert.equal(c.gameData.hp.current, 1);
  assert.equal(c.gameData.death.failures, 0);
});
test("short rest consumes one hit die at a time, cannot overspend and closes on other activity", () => {
  let c = character("wizard", 1);
  c = run(c, "rest", { kind: "short", hours: 1, worldHour: 10 });
  c = run(c, "hitDie", { classKey: "wizard" }, () => 6);
  assert.equal(c.gameData.hp.current, 23);
  assert.equal(c.result.healing, 8);
  assert.throws(() => run(c, "hitDie", { classKey: "wizard" }), /quedan/);
  c = run(c, "hp", { mode: "damage", amount: 1 });
  assert.throws(() => run(c, "hitDie", { classKey: "wizard" }), /Primero/);
});
test("2024 long rest restores all hit dice, reductions, slots and one exhaustion with narrative 16 hour gate", () => {
  let c = character();
  c.gameData.hitDiceSpent.wizard = 5;
  c.gameData.slotsSpent = { 1: 4 };
  c.gameData.exhaustion = 3;
  c = run(c, "reductions", { hp: 5, abilities: { intelligence: 2 } });
  assert.equal(rules.sheet(c).derived.spellcasting[0].dc, 14);
  c = run(c, "rest", { kind: "long", hours: 8, worldHour: 10 });
  assert.equal(c.gameData.hp.current, 30);
  assert.equal(c.gameData.exhaustion, 2);
  assert.deepEqual(c.gameData.hitDiceSpent, {});
  assert.deepEqual(c.gameData.slotsSpent, {});
  assert.deepEqual(c.gameData.abilityReductions, {});
  assert.throws(
    () => run(c, "rest", { kind: "long", hours: 8, worldHour: 33 }),
    /16 horas/,
  );
  assert.doesNotThrow(() =>
    run(c, "rest", { kind: "long", hours: 8, worldHour: 34 }),
  );
  assert.throws(
    () =>
      run(c, "rest", {
        kind: "long",
        hours: 8,
        worldHour: 34,
        interruptions: 1,
      }),
    /Duración/,
  );
});
test("interrupted long rest after an hour grants short benefits without long-rest healing", () => {
  let c = character("warlock", 3);
  c.gameData.slotsSpent.pact = 2;
  c = run(c, "rest", {
    kind: "long",
    hours: 2,
    worldHour: 8,
    interrupted: true,
  });
  assert.equal(c.gameData.slotsSpent.pact, 0);
  assert.equal(c.gameData.hp.current, 15);
  assert.equal(c.gameData.shortRestOpen, true);
});
test("casting atomically spends eligible slots and requires concentration replacement", () => {
  let c = character();
  const id = randomUUID();
  c.gameData.spells = [
    {
      id,
      name: "Web",
      origin: "wizard",
      level: 2,
      prepared: true,
      concentration: true,
      ritual: false,
    },
  ];
  c = run(c, "cast", { id, slotLevel: 2 });
  assert.equal(c.gameData.slotsSpent[2], 1);
  assert.equal(c.gameData.concentration, id);
  assert.throws(() => run(c, "cast", { id, slotLevel: 2 }), /concentración/);
  assert.throws(
    () => run(c, "cast", { id, slotLevel: 1, replaceConcentration: true }),
    /espacio/,
  );
  c = run(c, "cast", { id, slotLevel: 2, replaceConcentration: true });
  assert.equal(c.gameData.slotsSpent[2], 2);
  assert.throws(
    () =>
      run(c, "cast", {
        id,
        slotLevel: 2,
        ritual: true,
        replaceConcentration: true,
      }),
    /ritual/,
  );
  c = run(c, "spell", { operation: "remove", id });
  assert.equal(c.gameData.concentration, null);
});
test("inventory removal removes derived attacks; quantities of zero cannot grant attacks", () => {
  let c = character();
  const item = {
    id: randomUUID(),
    name: "Dagger",
    type: "weapon",
    equipped: true,
    quantity: 1,
    proficient: true,
    finesse: true,
    damage: "1d4",
  };
  c = run(c, "inventory", { operation: "upsert", item });
  assert.equal(rules.sheet(c).derived.attacks[0].attack, 5);
  c = run(c, "inventory", {
    operation: "upsert",
    item: { ...item, quantity: 0 },
  });
  assert.equal(rules.sheet(c).derived.attacks.length, 0);
});

test("Arcane Recovery uses wizard level, only spent standard slots and one use per long rest", () => {
  let c = character("wizard", 5);
  c.gameData.slotsSpent = { 1: 2, 2: 1 };
  c = run(c, "rest", { kind: "short", hours: 1, worldHour: 0 });
  assert.throws(() => run(c, "arcaneRecovery", { slots: [2, 2] }), /Excede/);
  c = run(c, "arcaneRecovery", { slots: [2, 1] });
  assert.equal(c.gameData.slotsSpent[2], 0);
  assert.equal(c.gameData.slotsSpent[1], 1);
  assert.throws(
    () => run(c, "arcaneRecovery", { slots: [1] }),
    /uso disponible/,
  );
  c = run(c, "rest", { kind: "long", hours: 8, worldHour: 10 });
  assert.equal(c.gameData.arcaneRecoveryUsed, false);
});
test("Wizard Ritual Adept permits an unprepared ritual only when in the spellbook", () => {
  let c = character();
  const id = randomUUID();
  c.gameData.spells = [
    {
      id,
      name: "Detect Magic",
      origin: "wizard",
      prepared: false,
      inSpellbook: true,
      ritual: true,
      level: 1,
      concentration: true,
    },
  ];
  c = run(c, "cast", { id, slotLevel: 0, ritual: true });
  assert.deepEqual(c.gameData.slotsSpent, {});
  c.gameData.spells[0].inSpellbook = false;
  assert.throws(
    () =>
      run(c, "cast", {
        id,
        slotLevel: 0,
        ritual: true,
        replaceConcentration: true,
      }),
    /preparado/,
  );
});
test("Interrupted short rest grants nothing; all twelve classes and their SRD subclasses are pinned", () => {
  assert.throws(
    () =>
      run(character(), "rest", {
        kind: "short",
        hours: 2,
        worldHour: 0,
        interrupted: true,
      }),
    /no concede/,
  );
  const data = require("../src/game/data/classes-2024.json");
  assert.equal(data.count, data.results.length);
  assert.equal(data.results.filter((c) => !c.subclass_of).length, 12);
  const c = character("wizard", 5);
  c.gameData.classes[0].subclass = "srd-2024_evoker";
  const d = rules.sheet(c).derived;
  assert.ok(d.classFeatures.some((f) => f.name === "Potent Cantrip"));
  assert.ok(!d.classFeatures.some((f) => f.name === "Empowered Evocation"));
});
