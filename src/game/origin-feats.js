const { randomUUID } = require("node:crypto");
const { fail } = require("../lib/http");
const spells = require("./data/origin-spells-2024.json");
const definitions = {
  "srd-2024_acolyte": {
    key: "magicInitiate",
    name: "Iniciado en la magia",
    list: "cleric",
    description:
      "Elegí dos trucos y un conjuro de nivel 1 de clérigo. Elegí Inteligencia, Sabiduría o Carisma. El conjuro de nivel 1 está siempre preparado y tiene un lanzamiento sin espacio por descanso largo.",
  },
  "srd-2024_sage": {
    key: "magicInitiate",
    name: "Iniciado en la magia",
    list: "wizard",
    description:
      "Elegí dos trucos y un conjuro de nivel 1 de mago. Elegí Inteligencia, Sabiduría o Carisma. El conjuro de nivel 1 está siempre preparado y tiene un lanzamiento sin espacio por descanso largo.",
  },
  "srd-2024_criminal": {
    key: "alert",
    name: "Alerta",
    description:
      "Agrega competencia a iniciativa. Después de tirar, podés intercambiar iniciativa con un aliado dispuesto del mismo combate si ninguno está incapacitado; acordá el intercambio en la mesa.",
  },
  "srd-2024_soldier": {
    key: "savageAttacker",
    name: "Atacante salvaje",
    description:
      "Una vez por turno, al impactar con un arma, tirá sus dados de daño dos veces y elegí un conjunto. Declarar un nuevo turno en la app habilita el uso siguiente; el impacto se confirma en la mesa.",
  },
};
function catalog() {
  return spells.map(({ pk, fields: s }) => ({
    key: pk,
    name: s.name,
    level: s.level,
    lists: s.classes.map((k) => k.replace("srd-2024_", "")),
    concentration: s.concentration,
    ritual: s.ritual,
    castingTime: s.casting_time,
    range: s.range_text,
    description:
      s.desc +
      (s.higher_level ? "\n\n" + s.higher_level : "") +
      "\n\nComponents: " +
      [
        s.verbal ? "V" : "",
        s.somatic ? "S" : "",
        s.material
          ? "M (" + (s.material_specified || "see description") + ")"
          : "",
      ]
        .filter(Boolean)
        .join(", ") +
      "\nDuration: " +
      s.duration,
    source: "Open5e · SRD 2024 · " + pk,
  }));
}
function definition(background) {
  return { ...definitions[background] };
}
function decide(background, choice) {
  const def = definition(background);
  if (def.key !== "magicInitiate") {
    if (choice) fail(422, "Esta dote no permite elegir conjuros.");
    return def;
  }
  if (!choice) return null;
  const rows = catalog(),
    keys = [...choice.cantrips, choice.spell];
  if (new Set(keys).size !== 3)
    fail(422, "Elegí dos trucos distintos y un conjuro de nivel 1.");
  const selected = keys.map((key, i) => {
    const spell = rows.find((s) => s.key === key);
    if (
      !spell ||
      spell.level !== (i < 2 ? 0 : 1) ||
      !spell.lists.includes(def.list)
    )
      fail(422, "El conjuro no pertenece al nivel o a la lista de tu dote.");
    return spell;
  });
  return { ...def, castingAbility: choice.castingAbility, spells: selected };
}
function initialize(decision) {
  const feat = decision.background.originFeat;
  if (feat?.key !== "magicInitiate") return {};
  return {
    spells: feat.spells.map(({ lists, ...s }) => ({
      ...s,
      id: randomUUID(),
      origin: feat.list,
      prepared: true,
      inSpellbook: false,
      grantedBy: "magicInitiate",
    })),
  };
}
module.exports = { catalog, definition, decide, initialize };
