// El alta y la vista previa usan la misma inicialización; consultar una ficha no pasa por aquí.
const rules = require("./rules");
module.exports = function creationState(character, decision, options = {}) {
  const state = {
    ...rules.initial(character),
    ...require("./class-basics").initialize(decision),
    ...require("./background-loadout").initialize(decision),
    ...require("./origin-feats").initialize(decision),
    creation: decision,
  };
  return decision.startingDefense
    ? require("./starting-defense").initialize(decision, state, options)
    : state;
};
