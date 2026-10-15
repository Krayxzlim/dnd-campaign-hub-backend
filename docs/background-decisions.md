# Trasfondos y atributos iniciales

Esta entrega implementa la elección del trasfondo y sus aumentos de atributos de nivel 1. Los cuatro trasfondos disponibles son Acólito, Criminal, Sabio y Soldado, procedentes del SRD 2024 de Open5e. No es el catálogo completo del Manual del Jugador. Las competencias de habilidad del trasfondo se conceden en las altas nuevas. La dote de origen, herramientas y equipo se muestran como información pendiente: todavía no se conceden ni ejecutan automáticamente.

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

RF-03 queda parcialmente cubierto (elección, información y aumentos); RF-07 registra base y trasfondo, pero no mejoras de niveles ni otras fuentes. RF-09 a RF-18, decisiones de dotes, equipo y competencias siguen pendientes. No se certifica una ficha completa.

## Competencias de habilidad del trasfondo

El catálogo anuncia `backgroundSkillsVersion: 1` y ofrece `skillGrants` con las claves de las dos habilidades concedidas. En altas nuevas, el servidor copia esas claves verificadas a `creation.background.skillGrants`; el cliente no puede elegir ni sobrescribir las concesiones. `skills` deja de figurar entre los beneficios pendientes para esas altas.

La ficha calcula el rango efectivo como el máximo entre el rango configurado y el rango concedido por el trasfondo. Competencia + competencia no es pericia. La pericia declarada en la configuración conserva su rango 2. La respuesta agrega `configuredRank`, `backgroundRank` y `backgroundSource`; las tiradas usan el modificador efectivo de la misma ficha. Configurar otras opciones no borra el origen de la competencia.

No hay migración implícita: las decisiones guardadas anteriormente sin `skillGrants` mantienen las competencias pendientes. Tampoco se deduce un trasfondo a partir del texto de fichas antiguas. Dotes, competencias de herramientas, equipo y elección de habilidades de clase siguen pendientes. La sustitución de habilidades duplicadas entre fuentes requerirá un flujo de elecciones explícito.
