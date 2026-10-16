# Trasfondos y atributos iniciales

Esta entrega implementa la elección del trasfondo y sus aumentos de atributos de nivel 1. Los cuatro trasfondos disponibles son Acólito, Criminal, Sabio y Soldado, procedentes del SRD 2024 de Open5e. No es el catálogo completo del Manual del Jugador. Las competencias de habilidad del trasfondo se conceden en las altas nuevas. Las altas con las decisiones correspondientes también conceden herramientas, equipo o monedas y dote de origen, como se detalla abajo.

## Contrato y persistencia

`GET /api/catalog/creation` mantiene versión 1 y agrega `backgroundDecisionsVersion: 1` y `backgrounds`. Cada trasfondo incluye clave, nombre, tres atributos permitidos, beneficios descriptivos y fuente.

`POST /api/catalog/creation/background-preview` recibe el objeto `creation` descrito abajo. Es autenticado y puro: devuelve los atributos finales, modificadores, desglose y decisión normalizada, sin escribir datos. Android muestra el mismo reparto localmente; la API lo revalida al guardar.

`POST /api/characters` acepta opcionalmente `creation` junto a los campos existentes:

```json
{
  "version": 1,
  "ruleset": "srd-2024",
  "speciesKey": "srd-2024_elf",
  "classKey": "wizard",
  "method": "standard",
  "baseScores": {"strength":8,"dexterity":14,"constitution":13,"intelligence":15,"wisdom":12,"charisma":10},
  "background": {
    "key":"srd-2024_sage",
    "increases":{"strength":0,"dexterity":0,"constitution":1,"intelligence":2,"wisdom":0,"charisma":0}
  }
}
```

Para tiradas se añade `rolls`, seis grupos de cuatro dados. La API valida los valores base con las reglas ya compartidas, exige gastar los 27 puntos al confirmar compra, comprueba +2/+1 en dos atributos permitidos o +1 en los tres y limita el resultado a 20. Especie, clase, nivel 1 y seis atributos finales del alta deben coincidir con la decisión. Las tiradas son resultados enviados por el cliente; esto valida su aritmética, no certifica un lanzamiento ante el DM.

Se guarda una copia normalizada en `gameData.creation`, junto a sus fuentes, valores base, aumentos y beneficios pendientes. Las columnas existentes guardan los valores permanentes finales. Ambos se insertan en una sola operación dentro de la transacción existente. No hay migración ni actualización automática de personajes previos.

La ficha agrega `breakdown` a cada atributo de los personajes nuevos: base, trasfondo, valor permanente, reducción temporal y total. El `baseScore` anterior mantiene su significado para compatibilidad: valor permanente de la columna antes de reducciones. Leer o recalcular no aplica de nuevo el trasfondo ni modifica PV, espacios o recursos.

## Compatibilidad y límites

El alta sin `creation` conserva el contrato anterior. Android permite elegir explícitamente «Completar trasfondo más adelante» y envía solo ese contrato; no inventa una decisión histórica para fichas existentes. Si el catálogo no anuncia esta capacidad, se explica la limitación.

Los personajes con una decisión guardada no permiten cambiar directamente especie, clase, nivel o atributos mediante el PUT genérico: hacerlo invalidaría la procedencia. La API devuelve 409 hasta que exista un flujo de progresión/corrección. Nombre, alineación y campaña siguen siendo editables. Configurar PV y recursos conserva la decisión y no puede sustituir su clase. La configuración restante mantiene su comportamiento anterior.

RF-03 queda parcialmente cubierto (elección, información y aumentos); RF-07 registra base y trasfondo, pero no mejoras de niveles ni otras fuentes. La progresión, las decisiones de clase y las concesiones de otras fuentes siguen pendientes. No se certifica una ficha completa.

## Competencias de habilidad del trasfondo

El catálogo anuncia `backgroundSkillsVersion: 1` y ofrece `skillGrants` con las claves de las dos habilidades concedidas. En altas nuevas, el servidor copia esas claves verificadas a `creation.background.skillGrants`; el cliente no puede elegir ni sobrescribir las concesiones. `skills` deja de figurar entre los beneficios pendientes para esas altas.

La ficha calcula el rango efectivo como el máximo entre el rango configurado y el rango concedido por el trasfondo. Competencia + competencia no es pericia. La pericia declarada en la configuración conserva su rango 2. La respuesta agrega `configuredRank`, `backgroundRank` y `backgroundSource`; las tiradas usan el modificador efectivo de la misma ficha. Configurar otras opciones no borra el origen de la competencia.

No hay migración implícita: las decisiones guardadas anteriormente sin `skillGrants` mantienen las competencias pendientes. Tampoco se deduce un trasfondo a partir del texto de fichas antiguas. La elección de habilidades de clase sigue pendiente. La sustitución de habilidades duplicadas entre fuentes requerirá un flujo de elecciones explícito.

## Equipo y herramientas iniciales

El catálogo anuncia `backgroundLoadoutVersion: 1`. La decisión puede incluir `equipmentOption` (A o B) y `toolChoice`. La opción A concede el paquete publicado y 8/16/8/14 po según Acólito/Criminal/Sabio/Soldado; B concede 50 po sin objetos. Soldado requiere uno de los cuatro juegos del SRD incluso al elegir B. La competencia de herramientas no depende de poseer el paquete.

El servidor conserva la decisión en `startingEquipment` y las competencias en `toolProficiencies`. Al insertar el personaje, crea el inventario con IDs únicos y el saldo en piezas de cobre (100 pc = 1 po), en la misma transacción. Las armas quedan sin equipar y sin competencia declarada: el trasfondo no concede competencia con esas armas. Sus propiedades y maestrías siguen necesitando la configuración de clase.

El comando `money` registra `deltaCopper` entero, impide saldo negativo y usa el protocolo de versión e idempotencia existente. Leer la ficha no repone objetos consumidos o dinero gastado. El inventario usa los comandos existentes. Las pruebas de herramientas usan la característica indicada en el SRD, el bono de competencia y agotamiento; la mesa determina si la herramienta está disponible y si corresponde usarla. No se agrega automáticamente ventaja por coincidencias con una habilidad.

## Dotes de origen

`originFeatsVersion: 1` anuncia las dotes de estos cuatro trasfondos. Criminal concede Alerta: suma competencia a iniciativa; el intercambio de iniciativa con un aliado se acuerda en la mesa. Soldado concede Atacante salvaje: el jugador declara el inicio de su turno y confirma un impacto con un arma equipada; el motor tira dos grupos de dados de daño del arma, permite comparar y limita el uso a una vez por turno declarado. Los críticos duplican esos dados. Los modificadores y el daño al objetivo se resuelven aparte; no hay un motor compartido de turnos.

Acólito y Sabio ofrecen Iniciado en la magia (clérigo y mago respectivamente). `originFeatChoice` contiene `castingAbility` (intelligence/wisdom/charisma), `cantrips` (dos claves distintas) y `spell` (una clave de nivel 1). El servidor valida lista y nivel contra el catálogo SRD incluido y guarda los conjuros preparados con su procedencia. No pueden borrarse ni sobrescribirse mediante el editor genérico. La elección de reemplazo al subir de nivel sigue pendiente.

El lanzamiento de nivel 1 con `originFeatUse: true` consume el uso gratuito, sin consumir espacios. Un descanso largo válido lo recupera; leer, descansar poco o interrumpir el descanso no lo recupera. Se puede lanzar con espacios disponibles mediante el flujo normal. Los trucos no consumen ese uso. La característica de lanzamiento de la dote se calcula independientemente de la clase. Los conjuros conservan la descripción de la fuente en inglés; sus efectos narrativos y objetivos se resuelven en la mesa.

Clientes anteriores pueden omitir estas elecciones: la respuesta conserva pendientes explícitos y no reconstruye concesiones para fichas antiguas. Completar estos beneficios de trasfondo no completa automáticamente las elecciones de especie, clase, competencias de armas ni PV.

## Competencias iniciales de clase

`classSkillsVersion: 1` y `classes[].skillChoices` anuncian el cupo y las opciones de las doce clases SRD. `skills` ofrece etiquetas en español. La decisión `creation.classSkills` es opcional por compatibilidad; si aparece, debe contener exactamente el cupo de claves distintas pertenecientes a esa clase. La validación del preview y del alta es la misma. Se guarda una copia canónica con fuente en `creation.classDecision.skillGrants`.

La ficha expone `classRank` y `classSource`. El rango efectivo es el máximo entre configuración, trasfondo y clase; dos competencias no conceden pericia. Configurar otras opciones no borra las concesiones. Las fichas anteriores conservan su comportamiento. La app muestra este paso cuando se eligió trasfondo (el contrato versionado actual requiere uno); diferirlo mantiene el flujo anterior.

Esta entrega no implementa sustituciones por duplicación entre fuentes ni pericia de clase, salvaciones, equipo de clase, conjuros de clase o sus otros rasgos. La selección duplicada con trasfondo se informa como un único bono. El catálogo deriva de las tablas Core Traits del snapshot `classes-2024.json`; se normalizan únicamente los cortes tipográficos «Na ture» e «In sight». Los textos y licencia SRD se conservan en la atribución existente.

## PV base y salvaciones de nivel 1

Las nuevas creaciones versionadas registran `classBasics`: dado de clase, modificador de Constitución final, PV base, salvaciones concedidas y fuente. El catálogo anuncia `classBasicsVersion: 1`. Los PV base son el máximo del dado más Constitución (mínimo 1); se inicializan una sola vez en la misma transacción del alta, con PV temporales cero. Consultar la ficha no restaura PV, espacios ni otros recursos.

Estos PV no incluyen aumentos de especie, dotes u otras fuentes todavía no implementadas. La ficha permanece sin configurar para que se revisen esas elecciones. La configuración explícita de PV sigue disponible; `classBasics` conserva el origen inicial, no reemplaza el máximo actual ni implica una reconstrucción por nivel.

Las salvaciones efectivas son la unión de las concedidas por clase y las configuradas, sin duplicar competencia. El cliente identifica y protege las concedidas; configurar otras opciones no las borra. No se migran personajes anteriores ni altas sin `creation`.

La verificación utiliza las tablas `CORE_TRAITS_TABLE` del snapshot SRD, no su campo resumido `saving_throws`: este último discrepa para guerrero y monje. Las tablas indican Fuerza/Constitución para guerrero y Fuerza/Destreza para monje. El snapshot original se conserva sin alteraciones.
