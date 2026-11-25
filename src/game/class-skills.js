const { fail } = require("../lib/http");
const definitions = require("./data/class-skills-2024.json");
function definition(key) {
  return structuredClone(definitions[key]);
}
function decide(key, choices) {
  if (choices === undefined) return null;
  const rule = definition(key);
  if (
    !rule ||
    choices.length !== rule.count ||
    new Set(choices).size !== rule.count ||
    choices.some((k) => !rule.options.includes(k))
  )
    fail(
      422,
      "Elegí la cantidad indicada de habilidades distintas de tu clase.",
    );
  return {
    skillGrants: [...choices],
    source: "Open5e · SRD 2024 · " + rule.source,
  };
}
module.exports = { definition, decide };
