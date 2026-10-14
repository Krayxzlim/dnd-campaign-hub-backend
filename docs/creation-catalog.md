# Catálogo de creación v1

Todos los endpoints requieren la autenticación habitual de `/api/catalog`.

`GET /creation` devuelve `ruleset: srd-2024`, `version: 1`, las seis `abilityKeys`, los métodos `standard`, `pointBuy` y `rolled`, y `classes`. Cada clase incluye clave y nombre, descripción editorial, atributos principales, orden recomendado, dado de golpe, salvaciones, rasgos básicos, rasgos disponibles de nivel 1, límite de progresión y fuente. `recommendedOrder` es una permutación de los seis atributos; sus prioridades secundarias son recomendaciones editables, no restricciones oficiales.

`GET /species` conserva sus campos anteriores y agrega `size`, `speed` y `traits` con nombre, descripción y tipo. Los textos proceden del snapshot SRD 2024 de Open5e. No se interpretan como elecciones persistidas ni como un catálogo completo del Manual del Jugador.

`POST /creation/preview` recibe `classKey`, `method` (`standard`, `pointBuy` o `rolled`) y `baseScores` con exactamente los seis atributos. Para `rolled`, `rolls` contiene seis grupos de cuatro dados de 1 a 6. Se descarta un dado menor por grupo y se compara el multiconjunto de resultados con los atributos, preservando valores repetidos. Estándar exige 15, 14, 13, 12, 10 y 8; compra admite 8–15 y como máximo 27 puntos.

La respuesta contiene `scope: base-abilities`, valores base, modificadores, recomendación y puntos restantes cuando corresponde. La recomendación usa el arreglo estándar para compra, y los resultados disponibles para estándar/tiradas. El preview no modifica datos ni consume recursos. No valida trasfondos, progresión ni un personaje completo; tampoco modifica las validaciones del alta existente.

Android consume el catálogo de clases y especies. Mantiene el cálculo local de atributos existente y aún no consume este preview. Si falla el catálogo, explica el error y ofrece reintentar; permite continuar con el flujo base sin recomendación. No aplica una recomendación al cargar el catálogo ni al cambiar de clase.
