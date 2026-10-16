const { CLASSES, ABILITIES, mod } = require("./rules");
function decide(key, scores) {
  const cl = CLASSES[key];
  return {
    level: 1,
    hitDie: cl.die,
    constitutionModifier: mod(scores.constitution),
    baseHitPoints: Math.max(1, cl.die + mod(scores.constitution)),
    saveGrants: cl.saves.map((i) => ABILITIES[i]),
    source: "Open5e · SRD 2024 · srd-2024_" + key + "_core-traits",
  };
}
function initialize(decision) {
  const hp = decision.classBasics.baseHitPoints;
  return { hp: { current: hp, max: hp, temp: 0 } };
}
module.exports = { decide, initialize };
