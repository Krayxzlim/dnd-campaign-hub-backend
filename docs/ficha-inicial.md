# Ficha calculada al terminar la creación

En el recorrido de nivel 1, el usuario elige la protección antes de confirmar. Usa la alternativa oficial de dinero de su clase (C para guerrero, B para las demás), sumada al dinero del trasfondo. Compra una armadura permitida y, si tiene entrenamiento, un escudo. Puede elegir sin armadura; el resto del dinero queda en la ficha. Los paquetes de clase A no se conceden además del oro, ni se inventa equipo gratuito.

El catálogo anuncia `startingDefenseVersion: 1` y publica entrenamiento, precios y dinero inicial. El cliente envía únicamente `creation.startingDefense: {armorKey, shield}`. La API comprueba entrenamiento, presupuesto y elecciones previas, calcula los valores y guarda en una sola transacción la protección equipada, el saldo, los PV y la procedencia.

El preview existente de trasfondo añade `startingStats`: PV, CA, iniciativa, velocidad, competencia, protección, saldo y explicación. El alta y el preview utilizan el mismo inicializador y el mismo motor de ficha. No se confía en valores finales de CA/PV enviados por el cliente. La vista previa no crea personajes ni modifica recursos.

Al guardar se inicializan PV actuales, máximos y baseMax; la ficha queda configurada para usar sus recursos básicos sin entrar en otro formulario. Las salvaciones, habilidades, iniciativa y espacios se derivan de las decisiones ya existentes. La defensa sin armadura de bárbaro y monje se recalcula a partir de los atributos actuales; equipar armadura la desactiva, y un escudo desactiva la del monje. El enano recibe +1 PV al nivel 1; el goliat tiene velocidad base 35 pies. La armadura pesada resta 10 pies si no se alcanza su Fuerza requerida.

La CA no suma distintas fórmulas de defensa. La lectura de la ficha nunca repone PV ni dinero. Las fichas previas y clientes que omiten esta decisión conservan el comportamiento anterior. La desventaja en Sigilo de la armadura se informa; su contexto sigue resolviéndose con los controles de tirada.

## Alcance

Esta entrega completa las estadísticas iniciales y la protección, no todos los rasgos de D&D. Faltan conjuros de clase, compras de armas y resto del equipo de clase, variantes de especie y rasgos que necesitan elecciones. Sacerdote protector, orden del druida y otras fuentes que amplían entrenamiento todavía no habilitan nuevas opciones en este paso. Los PV de niveles superiores y su progresión siguen pendientes. `configured` indica que los recursos básicos se pueden usar; no certifica la totalidad de reglas.

## Fuentes y verificación

- Oro y entrenamiento: tablas Core Traits del snapshot `src/game/data/classes-2024.json`.
- Armaduras y escudos: https://github.com/open5e/open5e-api/blob/staging/data/raw_sources/srd_5_2/sections/07_armor_items.md
- Defensa sin armadura, resistencia del enano y velocidad: snapshots SRD de clases y especies incluidos en el repositorio. Se conserva la atribución SRD de `src/game/data/backgrounds-source.md`.
- Pruebas de reglas: doce clases, costes, entrenamiento, defensa sin armadura, penalización de Fuerza, PV de enano y ausencia de recuperación al consultar.
- Integración: preview repetible y sin escrituras, creación con CA/PV coincidentes, uso inmediato de PV, reintento idempotente y rechazo de accesos ajenos.
