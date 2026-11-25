// Short paraphrases; contextual adjudication stays with the table in assistant mode.
module.exports = function actions(s, derived) {
  const add = (name, description, category = "Acción") => ({
    name,
    description,
    category,
  });
  const strength = derived.abilities[0].modifier;
  const dc = 8 + derived.proficiency + strength;
  const result = [
    add(
      "Atacar",
      `Realizá ${derived.attacksPerAction} ataque(s). Podés sustituir un ataque por un golpe sin armas; no se resuelve el objetivo automáticamente.`,
    ),
    add(
      "Golpe sin armas",
      `Daño: tirada de ataque con Fuerza y competencia; al impactar, ${Math.max(0, 1 + strength)} contundente. Agarrar o empujar: el objetivo elige salvación de Fuerza o Destreza, CD ${dc}; requiere alcance y tamaño válido. Empujar permite desplazar 5 pies o derribar.`,
    ),
    add(
      "Correr",
      `Obtenés movimiento adicional igual a tu velocidad actual (${derived.speed} pies), sujeto a modificadores.`,
    ),
    add(
      "Destrabarse",
      "Tu movimiento no provoca ataques de oportunidad durante el resto del turno.",
    ),
    add(
      "Esquivar",
      "Hasta tu próximo turno: ataques visibles contra vos con desventaja y salvaciones de Destreza con ventaja. Termina si quedás incapacitado o tu velocidad es 0.",
    ),
    add(
      "Ayudar",
      "Ayudá a una prueba con una competencia apropiada, o distraé a un enemigo a 5 pies para dar ventaja al próximo ataque de un aliado antes de tu siguiente turno.",
    ),
    add(
      "Esconderse",
      "Cumplí los requisitos de cobertura u oscuridad y de estar fuera de la vista enemiga. Prueba de Sigilo CD 15; guardá el total para detectar al personaje.",
    ),
    add(
      "Influir",
      "Presentá una petición a una criatura. El DM determina si es posible y la prueba apropiada según su actitud.",
    ),
    add(
      "Magia",
      "Lanzá un conjuro de una acción o activá un efecto mágico cuyo tiempo sea una acción. Revisá componentes y recursos.",
    ),
    add(
      "Preparar",
      "Elegí un desencadenante perceptible y una acción o movimiento. Usá tu reacción cuando ocurra antes de tu próximo turno. Preparar un conjuro requiere concentración y gasta el espacio al prepararlo.",
    ),
    add(
      "Buscar",
      "Prueba de Sabiduría apropiada: Perspicacia, Medicina, Percepción o Supervivencia.",
    ),
    add(
      "Estudiar",
      "Prueba de Inteligencia apropiada: Conocimiento arcano, Historia, Investigación, Naturaleza o Religión.",
    ),
    add(
      "Utilizar",
      "Usá un objeto cuyo uso requiera una acción. Objetos mágicos pueden requerir Magia.",
    ),
    add(
      "Improvisar",
      "Describí la acción al DM para acordar si es posible, la prueba, el coste y su efecto.",
    ),
    add(
      "Ataque de oportunidad",
      "Cuando una criatura visible sale de tu alcance usando movimiento, acción, acción adicional o reacción: un ataque cuerpo a cuerpo antes de que salga. No se provoca al teletransportarse ni por movimiento que no use esos medios.",
      "Reacción",
    ),
    add(
      "Interactuar con un objeto",
      "Una interacción sencilla durante tu movimiento o acción; una interacción adicional puede requerir Utilizar.",
      "Otras",
    ),
  ];
  if (
    s.inventory.filter(
      (x) =>
        x.type === "weapon" &&
        x.equipped &&
        x.quantity > 0 &&
        /light|ligera/i.test(x.notes),
    ).length >= 2
  )
    result.push(
      add(
        "Combate con dos armas · Ligera",
        "Tras atacar con un arma Ligera, un ataque adicional con otra arma Ligera. No agregues el modificador de característica al daño salvo si es negativo o un rasgo lo permite. Nick puede trasladarlo a la acción Atacar si tenés esa maestría.",
        "Acción adicional",
      ),
    );
  for (const r of s.resources)
    result.push(
      add(
        r.name,
        `${r.current}/${r.max} usos. Recuperación: ${r.recovery}. Consultá el rasgo antes de consumirlo desde Recursos.`,
        "Otras",
      ),
    );
  return result;
};
