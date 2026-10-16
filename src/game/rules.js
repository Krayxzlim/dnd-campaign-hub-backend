// SRD 5.2.1 core rules. Descriptions: https://www.dndbeyond.com/srd (CC BY 4.0).
const { randomInt } = require("node:crypto");
const { fail } = require("../lib/http");
const classFeatures = require("./class-features");
const ABILITIES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];
const LABELS = [
  "Fuerza",
  "Destreza",
  "Constitución",
  "Inteligencia",
  "Sabiduría",
  "Carisma",
];
const SKILLS = [
  ["athletics", "Atletismo", 0],
  ["acrobatics", "Acrobacias", 1],
  ["sleightOfHand", "Juego de manos", 1],
  ["stealth", "Sigilo", 1],
  ["arcana", "Conocimiento arcano", 3],
  ["history", "Historia", 3],
  ["investigation", "Investigación", 3],
  ["nature", "Naturaleza", 3],
  ["religion", "Religión", 3],
  ["animalHandling", "Trato con animales", 4],
  ["insight", "Perspicacia", 4],
  ["medicine", "Medicina", 4],
  ["perception", "Percepción", 4],
  ["survival", "Supervivencia", 4],
  ["deception", "Engaño", 5],
  ["intimidation", "Intimidación", 5],
  ["performance", "Interpretación", 5],
  ["persuasion", "Persuasión", 5],
];
const CLASSES = {
  barbarian: { label: "Bárbaro", die: 12, saves: [0, 2] },
  bard: { label: "Bardo", die: 8, saves: [1, 5], casting: 5, progression: 1 },
  cleric: {
    label: "Clérigo",
    die: 8,
    saves: [4, 5],
    casting: 4,
    progression: 1,
  },
  druid: { label: "Druida", die: 8, saves: [3, 4], casting: 4, progression: 1 },
  fighter: { label: "Guerrero", die: 10, saves: [0, 2] },
  monk: { label: "Monje", die: 8, saves: [0, 1] },
  paladin: {
    label: "Paladín",
    die: 10,
    saves: [4, 5],
    casting: 5,
    progression: 0.5,
  },
  ranger: {
    label: "Explorador",
    die: 10,
    saves: [0, 1],
    casting: 4,
    progression: 0.5,
  },
  rogue: { label: "Pícaro", die: 8, saves: [1, 3] },
  sorcerer: {
    label: "Hechicero",
    die: 6,
    saves: [2, 5],
    casting: 5,
    progression: 1,
  },
  warlock: { label: "Brujo", die: 8, saves: [4, 5], casting: 5 },
  wizard: { label: "Mago", die: 6, saves: [3, 4], casting: 3, progression: 1 },
};
const XP = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];
const SLOTS = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const mod = (n) => Math.floor((n - 10) / 2);
function classKey(name) {
  const n = String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    Object.keys(CLASSES).find(
      (k) =>
        k === n ||
        CLASSES[k].label
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") === n,
    ) || null
  );
}
function initial(c) {
  return {
    configured: false,
    classes: classKey(c.characterClass)
      ? [{ key: classKey(c.characterClass), level: c.level }]
      : [],
    hp: { current: 0, max: 0, temp: 0 },
    xp: XP[c.level - 1],
    speed: 30,
    armor: { base: 10, dexterity: true, dexCap: 99, shield: 0, bonus: 0 },
    skills: {},
    saveProficiencies: [],
    inventory: [],
    spells: [],
    resources: [],
    companions: [],
    slotsSpent: {},
    hitDiceSpent: {},
    exhaustion: 0,
    conditions: [],
    concentration: null,
    death: { successes: 0, failures: 0 },
    lastLongRestEnd: null,
    shortRestOpen: false,
  };
}
function state(c) {
  return c.gameData && Object.keys(c.gameData).length
    ? structuredClone(c.gameData)
    : initial(c);
}
function slotMax(s) {
  const level = Math.min(
    20,
    s.classes.reduce(
      (a, c) =>
        a +
        (CLASSES[c.key]?.progression === 0.5
          ? Math.ceil(c.level / 2)
          : CLASSES[c.key]?.progression
            ? c.level
            : 0),
      0,
    ),
  );
  return SLOTS[level] || [];
}
function abilityMod(c, s, key) {
  return mod(Math.max(1, c[key] - (s.abilityReductions?.[key] || 0)));
}
function sheet(c) {
  const s = state(c),
    total = c.level,
    pb = 2 + Math.floor((total - 1) / 4),
    mods = ABILITIES.map((k) => abilityMod(c, s, k)),
    penalty = s.exhaustion * 2;
  const classSaveGrants = s.creation?.classBasics?.saveGrants || [];
  const saveProficiencies = new Set([
    ...s.saveProficiencies,
    ...classSaveGrants,
  ]);
  const saves = ABILITIES.map((key, i) => ({
    key,
    label: LABELS[i],
    score: Math.max(1, c[key] - (s.abilityReductions?.[key] || 0)),
    baseScore: c[key],
    ...(s.creation
      ? {
          breakdown: {
            base: s.creation.baseScores[key],
            background: s.creation.background.increases[key],
            permanent: c[key],
            reduction: s.abilityReductions?.[key] || 0,
            total: Math.max(1, c[key] - (s.abilityReductions?.[key] || 0)),
          },
        }
      : {}),
    modifier: mods[i] + (saveProficiencies.has(key) ? pb : 0) - penalty,
    proficient: saveProficiencies.has(key),
    classProficient: classSaveGrants.includes(key),
    ...(classSaveGrants.includes(key)
      ? { classSource: CLASSES[s.creation.classKey].label }
      : {}),
  }));
  const background = s.creation?.background;
  const originFeat = background?.originFeat;
  const skills = SKILLS.map(([key, label, i]) => {
    const configuredRank = s.skills[key] || 0;
    const backgroundRank = background?.skillGrants?.includes(key) ? 1 : 0;
    const classRank = s.creation?.classDecision?.skillGrants?.includes(key)
      ? 1
      : 0;
    const rank = Math.max(configuredRank, backgroundRank, classRank);
    return {
      key,
      label,
      ability: ABILITIES[i],
      rank,
      configuredRank,
      backgroundRank,
      classRank,
      ...(classRank ? { classSource: CLASSES[s.creation.classKey].label } : {}),
      ...(backgroundRank ? { backgroundSource: background.name } : {}),
      modifier: mods[i] + pb * rank - penalty,
    };
  });
  const slots = slotMax(s).map((max, i) => ({
    level: i + 1,
    max,
    remaining: Math.max(0, max - (s.slotsSpent[i + 1] || 0)),
  }));
  const warlock = s.classes.find((x) => x.key === "warlock");
  if (warlock) {
    const l = warlock.level,
      max = l === 1 ? 1 : l < 11 ? 2 : l < 17 ? 3 : 4;
    slots.push({
      level: Math.min(5, Math.ceil(l / 2)),
      max,
      remaining: Math.max(0, max - (s.slotsSpent.pact || 0)),
      pool: "pact",
    });
  }
  const armor = s.inventory.find(
    (x) => x.equipped && x.quantity > 0 && x.type === "armor",
  );
  const a = armor?.armor || s.armor;
  const shield = s.inventory.some(
    (x) => x.equipped && x.quantity > 0 && x.type === "shield",
  )
    ? 2
    : 0;
  const ac =
    a.base +
    (a.dexterity ? Math.min(mods[1], a.dexCap) : 0) +
    Math.max(a.shield, shield) +
    a.bonus;
  const spellcasting = s.classes
    .filter((x) => CLASSES[x.key].casting !== undefined)
    .map((x) => ({
      origin: x.key,
      label: CLASSES[x.key].label,
      ability: ABILITIES[CLASSES[x.key].casting],
      modifier: mods[CLASSES[x.key].casting],
      attack: pb + mods[CLASSES[x.key].casting] - penalty,
      dc: 8 + pb + mods[CLASSES[x.key].casting],
    }));
  if (originFeat?.key === "magicInitiate") {
    const modifier = mods[ABILITIES.indexOf(originFeat.castingAbility)];
    spellcasting.push({
      origin: "magicInitiate",
      label: originFeat.name,
      ability: originFeat.castingAbility,
      modifier,
      attack: pb + modifier - penalty,
      dc: 8 + pb + modifier,
    });
  }
  const attacks = s.inventory
    .filter((x) => x.type === "weapon" && x.equipped && x.quantity > 0)
    .map((x) => {
      const ability = x.finesse
        ? Math.max(mods[0], mods[1])
        : x.ranged
          ? mods[1]
          : mods[0];
      return {
        id: x.id,
        name: x.name,
        kind: "attack",
        cost: "action",
        attack: ability + (x.proficient ? pb : 0) + x.bonus - penalty,
        damage:
          x.damage + (ability + x.bonus >= 0 ? "+" : "") + (ability + x.bonus),
        range: x.range,
        notes: x.notes,
      };
    });
  const levelOf = (k) => s.classes.find((x) => x.key === k)?.level || 0;
  const attacksPerAction = Math.max(
    1,
    ...["barbarian", "fighter", "monk", "paladin", "ranger"].map((k) =>
      levelOf(k) >= 5 ? 2 : 1,
    ),
    levelOf("fighter") >= 11 ? 3 : 1,
    levelOf("fighter") >= 20 ? 4 : 1,
  );
  const output = {
    characterId: c.id,
    stateVersion: c.stateVersion,
    schemaVersion: 1,
    rulesVersion: "srd-5.2.1-core-1",
    identity: {
      name: c.name,
      race: c.race,
      characterClass: c.characterClass,
      level: total,
      campaignId: c.campaignId,
    },
    state: s,
    derived: {
      abilities: ABILITIES.map((key, i) => ({
        key,
        label: LABELS[i],
        score: Math.max(1, c[key] - (s.abilityReductions?.[key] || 0)),
        baseScore: c[key],
        ...(s.creation
          ? {
              breakdown: {
                base: s.creation.baseScores[key],
                background: s.creation.background.increases[key],
                permanent: c[key],
                reduction: s.abilityReductions?.[key] || 0,
                total: Math.max(1, c[key] - (s.abilityReductions?.[key] || 0)),
              },
            }
          : {}),
        modifier: mods[i],
      })),
      tools: (s.creation?.background?.toolProficiencies || []).map((tool) => ({
        ...tool,
        modifier: mods[ABILITIES.indexOf(tool.ability)] + pb - penalty,
        source: s.creation.background.name,
      })),
      currency: { copper: s.currency?.copper || 0 },
      proficiency: pb,
      saves,
      skills,
      ac: s.configured ? ac : null,
      initiative: mods[1] + (originFeat?.key === "alert" ? pb : 0) - penalty,
      originFeat: originFeat
        ? {
            ...originFeat,
            freeCastRemaining:
              originFeat.key === "magicInitiate"
                ? s.magicInitiateUsed
                  ? 0
                  : 1
                : undefined,
            turn: s.combatTurn || 0,
            availableThisTurn:
              originFeat.key === "savageAttacker" &&
              (s.combatTurn || 0) > 0 &&
              s.savageAttackerTurn !== s.combatTurn,
          }
        : null,
      speed: Math.max(0, s.speed - s.exhaustion * 5),
      passivePerception:
        10 + skills.find((x) => x.key === "perception").modifier,
      slots,
      spellcasting,
      attacks,
      attacksPerAction,
      hitDice: s.classes.map((x) => ({
        key: x.key,
        die: CLASSES[x.key].die,
        max: x.level,
        remaining: Math.max(0, x.level - (s.hitDiceSpent[x.key] || 0)),
      })),
      xp: { current: s.xp, start: XP[total - 1], next: XP[total] || null },
    },
    completeness: {
      configured: s.configured,
      automation: "core",
      warnings: s.configured
        ? [
            "Rasgos y excepciones no enumerados: resolución asistida; no se certifica automatización completa de todas las clases.",
          ]
        : ["Completá PV, competencias, equipo y elecciones antes de jugar."],
    },
  };
  if (s.creation) {
    const labels = {
      originFeat: "dote de origen",
      skills: "competencias de habilidad",
      tools: "herramientas",
      equipment: "equipo",
    };
    if (s.creation.pending?.length)
      output.completeness.warnings.push(
        "Trasfondo pendiente: " +
          s.creation.pending.map((k) => labels[k] || k).join(", ") +
          ".",
      );
  }
  output.derived.classFeatures = classFeatures.features(s.classes);
  output.derived.subclassOptions = Object.fromEntries(
    Object.keys(CLASSES).map((k) => [k, classFeatures.subclassOptions(k)]),
  );
  output.derived.arcaneRecovery = {
    limit: Math.ceil(
      (s.classes.find((x) => x.key === "wizard")?.level || 0) / 2,
    ),
    available: s.shortRestOpen && !s.arcaneRecoveryUsed,
  };
  output.derived.actions = require("./actions")(s, output.derived);
  return output;
}
function apply(c, command, roll = (sides) => randomInt(1, sides + 1)) {
  const s = state(c),
    before = sheet(c);
  let result = {};
  const { type, data: d } = command;
  if (!["rest", "hitDie", "arcaneRecovery"].includes(type))
    s.shortRestOpen = false;
  const requireReady = () => {
    if (!s.configured) fail(422, "Completá la ficha antes de usar recursos.");
  };
  if (type === "configure") {
    if (
      s.creation &&
      (d.classes.length !== 1 || d.classes[0].key !== s.creation.classKey)
    )
      fail(
        422,
        "La clase debe coincidir con la decisión de creación guardada.",
      );
    const total = d.classes.reduce((a, x) => a + x.level, 0);
    if (total !== c.level)
      fail(422, "Los niveles de clase deben sumar el nivel del personaje.");
    for (const cl of d.classes)
      if (
        cl.subclass &&
        (cl.level < 3 ||
          !classFeatures
            .subclassOptions(cl.key)
            .some((x) => x.key === cl.subclass))
      )
        fail(422, "La subclase no corresponde a la clase o al nivel.");
    Object.assign(s, d, { configured: true });
    s.hp.baseMax = d.hp.max;
    s.hp.max = Math.max(1, d.hp.max - (s.hpReduction || 0));
    s.hp.current = Math.min(s.hp.current, s.hp.max);
  } else if (type === "hp") {
    requireReady();
    if (d.mode === "damage") {
      const prior = s.hp.current,
        absorbed = Math.min(s.hp.temp, d.amount),
        actual = d.amount - absorbed;
      s.hp.temp -= absorbed;
      s.hp.current = Math.max(0, prior - actual);
      if (s.concentration && d.amount)
        result.concentrationSaveDc = Math.min(
          30,
          Math.max(10, Math.floor(d.amount / 2)),
        );
      if (prior === 0 && d.amount > 0) {
        s.death.successes = 0;
        s.death.failures = Math.min(3, s.death.failures + (d.critical ? 2 : 1));
      }
      if (actual - prior >= s.hp.max) {
        s.death.failures = 3;
        result.reminder =
          "Daño masivo: muerte instantánea. Confirmá las excepciones con el DM.";
      }
      if (s.hp.current === 0) s.concentration = null;
    }
    if (d.mode === "heal") {
      if (s.death.failures === 3)
        fail(
          422,
          "Un personaje muerto requiere un efecto específico, no curación normal.",
        );
      s.hp.current = Math.min(s.hp.max, s.hp.current + d.amount);
      if (s.hp.current > 0) s.death = { successes: 0, failures: 0 };
    }
    if (d.mode === "temporary") s.hp.temp = d.amount;
  } else if (type === "roll") {
    requireReady();
    let bonus = 0,
      sides = d.sides || 20,
      count = d.count || 1;
    if (d.kind === "save" || d.kind === "skill" || d.kind === "tool") {
      const item = before.derived[
        d.kind === "save" ? "saves" : d.kind === "tool" ? "tools" : "skills"
      ].find((x) => x.key === d.key);
      if (!item) fail(422, "Prueba desconocida");
      bonus = item.modifier;
      sides = 20;
      count = 1;
    }
    if (d.kind === "initiative") {
      bonus = before.derived.initiative;
      sides = 20;
      count = 1;
    }
    if (d.kind === "attack") {
      const item = before.derived.attacks.find((x) => x.id === d.key);
      if (!item) fail(422, "Ataque no disponible");
      bonus = item.attack;
      sides = 20;
      count = 1;
    }
    if (d.kind === "death") {
      if (
        s.hp.current !== 0 ||
        s.death.successes === 3 ||
        s.death.failures === 3
      )
        fail(422, "No corresponde una salvación contra muerte en este estado.");
      bonus = -s.exhaustion * 2;
      sides = 20;
      count = 1;
    }
    const advantage = d.advantage && !d.disadvantage,
      disadvantage = d.disadvantage && !d.advantage;
    if ((advantage || disadvantage) && (sides !== 20 || count !== 1))
      fail(422, "Ventaja solo para una prueba d20.");
    const dice = Array.from(
      { length: advantage || disadvantage ? 2 : count },
      () => roll(sides),
    );
    const chosen = advantage
      ? Math.max(...dice)
      : disadvantage
        ? Math.min(...dice)
        : dice.reduce((a, b) => a + b, 0);
    result = {
      dice,
      sides,
      modifier: bonus + (d.modifier || 0),
      total: chosen + bonus + (d.modifier || 0),
      kind: d.kind,
    };
    if (d.kind === "death") {
      if (chosen === 20) {
        s.hp.current = 1;
        s.death = { successes: 0, failures: 0 };
      } else if (chosen === 1)
        s.death.failures = Math.min(3, s.death.failures + 2);
      else if (result.total >= 10)
        s.death.successes = Math.min(3, s.death.successes + 1);
      else s.death.failures = Math.min(3, s.death.failures + 1);
    }
  } else if (type === "rest") {
    requireReady();
    if (s.hp.current < 1)
      fail(422, "Necesitás al menos 1 PV para comenzar un descanso.");
    if (d.kind === "short" && d.interrupted)
      fail(422, "Un descanso corto interrumpido no concede beneficios.");
    if (d.kind === "short" || d.interrupted) {
      if (d.hours < 1) fail(422, "El descanso corto requiere una hora.");
      if (d.interrupted)
        result.reminder =
          "Interrumpido tras al menos una hora: solo beneficios de descanso corto.";
      s.shortRestOpen = true;
      s.slotsSpent.pact = 0;
      s.resources = s.resources.map((r) => ({
        ...r,
        current: r.recovery === "short" ? r.max : r.current,
      }));
    } else {
      if (d.hours < (d.trance ? 4 : 8) + (d.interruptions || 0))
        fail(422, "Duración insuficiente.");
      if (d.trance && !s.features?.includes("trance"))
        fail(422, "La ficha no tiene Trance.");
      if (s.lastLongRestEnd !== null && d.worldHour - s.lastLongRestEnd < 16)
        fail(
          422,
          "Deben pasar 16 horas del mundo desde finalizar el descanso anterior.",
        );
      s.hp.max = s.hp.baseMax || s.hp.max;
      s.hpReduction = 0;
      s.abilityReductions = {};
      s.arcaneRecoveryUsed = false;
      s.magicInitiateUsed = false;
      s.hp.current = s.hp.max;
      s.hp.temp = 0;
      s.hitDiceSpent = {};
      s.slotsSpent = {};
      s.exhaustion = Math.max(0, s.exhaustion - 1);
      s.shortRestOpen = false;
      s.lastLongRestEnd = d.worldHour + d.hours;
      s.resources = s.resources.map((r) => ({
        ...r,
        current: r.recovery === "manual" ? r.current : r.max,
      }));
      s.concentration = null;
      s.death = { successes: 0, failures: 0 };
    }
  } else if (type === "arcaneRecovery") {
    requireReady();
    const cl = s.classes.find((x) => x.key === "wizard");
    if (!cl || !s.shortRestOpen || s.arcaneRecoveryUsed)
      fail(
        422,
        "Recuperación arcana requiere finalizar un descanso corto y un uso disponible.",
      );
    if (d.slots.reduce((sum, n) => sum + n, 0) > Math.ceil(cl.level / 2))
      fail(422, "Excede los niveles de espacio recuperables.");
    for (const level of d.slots) {
      if (!(s.slotsSpent[level] > 0))
        fail(422, "Solo podés recuperar espacios estándar gastados.");
      s.slotsSpent[level]--;
    }
    s.arcaneRecoveryUsed = true;
    result.reminder =
      "Recuperación arcana usada hasta el próximo descanso largo.";
  } else if (type === "hitDie") {
    requireReady();
    if (!s.shortRestOpen) fail(422, "Primero confirmá un descanso corto.");
    const cl = before.derived.hitDice.find((x) => x.key === d.classKey);
    if (!cl || cl.remaining < 1) fail(422, "No quedan dados de golpe.");
    const die = roll(cl.die),
      healing = Math.max(1, die + abilityMod(c, s, "constitution"));
    s.hitDiceSpent[d.classKey] = (s.hitDiceSpent[d.classKey] || 0) + 1;
    result = {
      dice: [die],
      healing: Math.min(healing, s.hp.max - s.hp.current),
    };
    s.hp.current = Math.min(s.hp.max, s.hp.current + healing);
  } else if (type === "resource") {
    requireReady();
    const r = s.resources.find((x) => x.id === d.id);
    if (!r || r.current < d.amount) fail(422, "Recurso insuficiente.");
    r.current -= d.amount;
  } else if (type === "cast") {
    requireReady();
    const spell = s.spells.find((x) => x.id === d.id);
    if (
      !spell ||
      (!spell.prepared &&
        !(
          d.ritual &&
          spell.ritual &&
          spell.inSpellbook &&
          spell.origin === "wizard" &&
          s.classes.some((c) => c.key === "wizard")
        ))
    )
      fail(
        422,
        "El conjuro no está preparado ni disponible como ritual de tu libro.",
      );
    const granted =
      spell.grantedBy === "magicInitiate" &&
      s.creation?.background?.originFeat?.key === "magicInitiate" &&
      s.creation.background.originFeat.spells.some((x) => x.key === spell.key);
    if (!granted && !s.classes.some((c) => c.key === spell.origin))
      fail(422, "El origen del conjuro no pertenece a tus clases.");
    if (spell.concentration && s.concentration && !d.replaceConcentration)
      fail(422, "Confirmá reemplazar la concentración.");
    if (d.ritual && !spell.ritual) fail(422, "Este conjuro no admite ritual.");
    if (d.originFeatUse && (!granted || spell.level !== 1 || d.ritual))
      fail(
        422,
        "El uso gratuito solo corresponde al conjuro de nivel 1 de Iniciado en la magia.",
      );
    if (d.originFeatUse && s.magicInitiateUsed)
      fail(
        422,
        "El lanzamiento gratuito se recupera al finalizar un descanso largo.",
      );
    if (d.originFeatUse) s.magicInitiateUsed = true;
    if (!d.ritual && !d.originFeatUse && spell.level > 0) {
      const slot = before.derived.slots.find(
        (x) =>
          x.level === d.slotLevel &&
          (x.pool || "standard") === (d.pool || "standard"),
      );
      if (!slot || slot.level < spell.level || slot.remaining < 1)
        fail(422, "No hay un espacio elegible.");
      const key = d.pool === "pact" ? "pact" : String(d.slotLevel);
      s.slotsSpent[key] = (s.slotsSpent[key] || 0) + 1;
    }
    if (spell.concentration) s.concentration = spell.id;
    result = {
      spell: spell.name,
      reminder:
        "Verificá componentes, contexto y límite de espacio por turno con el DM.",
    };
  } else if (type === "beginTurn") {
    requireReady();
    if (s.creation?.background?.originFeat?.key !== "savageAttacker")
      fail(422, "La ficha no tiene Atacante salvaje.");
    if ((s.combatTurn || 0) >= 1000000000)
      fail(422, "Límite de turnos alcanzado.");
    s.combatTurn = (s.combatTurn || 0) + 1;
    result = {
      reminder: "Nuevo turno declarado. Atacante salvaje disponible una vez.",
    };
  } else if (type === "savageAttacker") {
    requireReady();
    if (!before.derived.originFeat?.availableThisTurn)
      fail(
        422,
        "Declará un nuevo turno de combate para usar Atacante salvaje.",
      );
    const weapon = s.inventory.find(
      (x) =>
        x.id === d.weaponId &&
        x.type === "weapon" &&
        x.equipped &&
        x.quantity > 0,
    );
    if (!weapon) fail(422, "Elegí un arma equipada.");
    const match = /^(\d{1,2})d(4|6|8|10|12|20)$/.exec(weapon.damage);
    if (!match) fail(422, "Dados de arma no válidos.");
    const count = Number(match[1]) * (d.critical ? 2 : 1),
      sides = Number(match[2]);
    const sets = Array.from({ length: 2 }, () =>
      Array.from({ length: count }, () => roll(sides)),
    );
    const totals = sets.map((dice) => dice.reduce((a, b) => a + b, 0));
    s.savageAttackerTurn = s.combatTurn;
    result = {
      sets,
      totals,
      recommended: totals[0] >= totals[1] ? 0 : 1,
      reminder: `Dados del arma: ${totals[0]} o ${totals[1]}. Elegí un conjunto y agregá los modificadores habituales; no se aplica daño al objetivo automáticamente.`,
    };
  } else if (type === "money") {
    const current = s.currency?.copper || 0;
    const next = current + d.deltaCopper;
    if (next < 0 || next > 1000000000)
      fail(422, "El saldo no puede ser negativo ni superar el límite.");
    s.currency = { copper: next };
    result = { deltaCopper: d.deltaCopper, copper: next };
  } else if (type === "inventory") {
    if (d.operation === "remove")
      s.inventory = s.inventory.filter((x) => x.id !== d.id);
    else {
      const index = s.inventory.findIndex((x) => x.id === d.item.id);
      if (index < 0) s.inventory.push(d.item);
      else s.inventory[index] = d.item;
    }
  } else if (type === "spell") {
    const target = d.operation === "remove" ? d.id : d.spell.id;
    if (
      s.spells.some(
        (spell) => spell.id === target && spell.grantedBy === "magicInitiate",
      )
    )
      fail(
        422,
        "Los conjuros concedidos por la dote se conservan como decisión de creación. Su cambio requiere un avance de nivel.",
      );
    if (d.operation === "remove") {
      s.spells = s.spells.filter((x) => x.id !== d.id);
      if (s.concentration === d.id) s.concentration = null;
    } else {
      const index = s.spells.findIndex((x) => x.id === d.spell.id);
      if (index < 0) s.spells.push(d.spell);
      else s.spells[index] = d.spell;
    }
  } else if (type === "companion") {
    if (d.operation === "remove")
      s.companions = s.companions.filter((x) => x.id !== d.id);
    else {
      const index = s.companions.findIndex((x) => x.id === d.companion.id);
      if (index < 0) s.companions.push(d.companion);
      else s.companions[index] = d.companion;
    }
  } else if (type === "reductions") {
    requireReady();
    if (d.hp >= (s.hp.baseMax || s.hp.max))
      fail(
        422,
        "La reducción a 0 PV máximos requiere resolver el efecto específico con el DM.",
      );
    s.hp.baseMax = s.hp.baseMax || s.hp.max;
    s.hpReduction = d.hp;
    s.hp.max = s.hp.baseMax - d.hp;
    s.hp.current = Math.min(s.hp.current, s.hp.max);
    s.abilityReductions = d.abilities;
  } else if (type === "status") {
    requireReady();
    s.exhaustion = d.exhaustion;
    s.conditions = d.conditions;
    if (d.exhaustion === 6) s.death.failures = 3;
    if (
      d.endConcentration ||
      d.conditions.some((c) =>
        /^(incapacitated|unconscious|paralyzed|stunned|petrified|incapacitado|inconsciente|paralizado|aturdido|petrificado)$/i.test(
          c,
        ),
      )
    )
      s.concentration = null;
  } else fail(422, "Operación no admitida");
  if (
    s.inventory.length > 200 ||
    s.spells.length > 200 ||
    s.companions.length > 20
  )
    fail(422, "Límite de registros alcanzado.");
  if (Buffer.byteLength(JSON.stringify(s)) > 512 * 1024)
    fail(
      422,
      "La ficha supera el límite de tamaño. Reducí descripciones o registros.",
    );
  return { state: s, result };
}
module.exports = {
  ABILITIES,
  LABELS,
  SKILLS,
  CLASSES,
  XP,
  SLOTS,
  mod,
  classKey,
  initial,
  state,
  sheet,
  apply,
};
