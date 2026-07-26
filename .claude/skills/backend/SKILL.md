---
name: backend
description: Construir o modificar el backend de Oppy — rutas, servicios, repositorios, esquema de base de datos, el pipeline del agente, scraping y scoring. Usar siempre que se toque backend/, se cambie el esquema, o se agregue lógica de dominio.
---

# Backend de Oppy

## Regla cero: ante la duda, preguntá

**No implementes una decisión de arquitectura o de dominio que no esté
escrita.** Si al ir a codear te encontrás eligiendo entre dos diseños
razonables, parás y preguntás. Lo que se decide en un diff no queda registrado
en ningún lado, y en un sistema donde el esquema está congelado eso se paga
caro.

Preguntá **siempre** antes de:

- Cambiar el esquema de base de datos — agregar, renombrar o borrar una columna
- Tocar el contrato central (el esquema de oportunidad de [`docs/03-modulos.md`](../../../docs/03-modulos.md))
- Agregar una dependencia
- Cambiar una de las cinco decisiones que no se negocian del [plan maestro](../../../docs/00-plan-maestro.md)
- Elegir entre dos formas de modelar algo cuando el doc no dice cuál
- Definir el comportamiento ante un fallo que nadie especificó
- Agregar un endpoint que nadie pidió

No preguntes por: nombres de funciones internas, cómo partir un archivo,
estructura de un test, o cualquier cosa resuelta en un archivo vecino.

Cuando preguntes, traé una recomendación y el costo de cada opción.

## Los invariantes

Están en [`CLAUDE.md`](../../../CLAUDE.md) y no se rompen sin un spec:

- **El SQL vive solo en `repositories/`.** Las rutas no tienen lógica de negocio; los servicios no escriben SQL.
- **El LLM vive detrás de una interfaz** (`services/llm/index.js`). Ningún módulo importa un proveedor directo. Cambiar de proveedor es configuración, no refactor.
- **Toda salida estructurada del modelo cruza un schema de Zod.** Lo que no lo cruza, no entra al sistema. Se reintenta una vez devolviéndole el error al modelo.
- **Las fuentes son datos, no código** (`services/scraping/sources.js`). Agregar una fuente es agregar un objeto.
- **Nada tumba una corrida.** Los clientes de scraping y búsqueda nunca lanzan: devuelven vacío y lo registran. Que respondan 3 de 5 fuentes es un éxito.
- **El scoring es simétrico.** `evaluar(perfil, oportunidad)` no sabe quién es el "usuario", así que el matching inverso reusa el mismo motor.
- **La confianza es código, no criterio del modelo.** El semáforo sale de reglas explícitas y auditables. Si el LLM pudiera otorgar el 🟢, el semáforo no valdría nada.
- **Un solo camino de código, dos disparadores.** El botón y el cron ejecutan el mismo pipeline.
- **El entorno se valida al arrancar** con Zod. Si falta algo, el proceso falla temprano y ruidosamente.

## El agente no crea el perfil

Lo construye el frontend, lo guarda el backend, el agente lo recibe como
contexto. Ver [`docs/10-contrato-agente.md`](../../../docs/10-contrato-agente.md).

Y el agente **devuelve objetos estructurados, nunca texto para pintar**. Si tu
salida trae markdown o una frase lista para renderizar, invadiste el producto.

## Código limpio

**Funciones.** Una responsabilidad. Si necesitás un comentario para explicar
*qué* hace un bloque, ese bloque quiere ser una función con nombre.

**Comentarios.** Explican el **porqué**, no el qué. El comentario valioso es el
que registra una decisión o previene un cambio equivocado:

```js
✖  // Recorre las oportunidades y las guarda
✔  // El indice es compartido: dedupe por hash antes de insertar, porque la
   // misma convocatoria llega por dos fuentes y contarla dos veces inflaria
   // la metrica que se muestra al usuario.
```

**Nombres.** Identificadores de dominio en español (`clasificar`, `perfil`,
`fechaLimite`, `compatibilidad`). No se traducen a inglés a medias. Sin
abreviaturas inventadas.

**Errores.** Errores de dominio con `AppError`; rutas envueltas en
`asyncHandler`. Nunca un `catch` vacío: o se maneja, o se registra con contexto,
o se propaga.

```js
✖  catch { }
✔  catch (error) { log.warn('No se pudo normalizar', { url, error: error.message }); return []; }
```

**Logging.** Siempre `logger.child({ module })`. Nunca `console.log`. Nunca
loguear secretos, claves ni el perfil completo de una persona.

**Formato.** ESM en todo el repo, imports con extensión `.js`. Comentarios de
código sin tildes; los `.md` sí las llevan. Sin linter configurado: se imita el
estilo del archivo vecino.

## Capas

```
routes/         HTTP. Valida entrada, llama a un servicio, responde. Nada más.
services/       Lógica de dominio. No escribe SQL, no conoce Express.
repositories/   Único lugar con SQL. Traduce fila ↔ objeto de dominio.
config/         Entorno validado con Zod al arrancar.
jobs/           Corrida autónoma. Dispara el mismo pipeline que la ruta.
```

Una ruta que arma un `WHERE`, o un servicio que recibe `req`, están en la capa
equivocada.

## Base de datos

- El esquema es **idempotente** (`CREATE ... IF NOT EXISTS`) y la migración es aplicarlo.
- Ojo: eso significa que **agregar una columna a una tabla que ya existe no se aplica sola**. Un cambio de esquema necesita su `ALTER ... IF NOT EXISTS`, o instrucciones explícitas de recrear la base.
- Toda consulta parametrizada (`$1`, `$2`). Nunca interpolar valores en el SQL.
- Las convocatorias vencidas no se borran: el histórico permite anticipar las que se repiten cada año.
- `seed` inserta sin upsert: correrlo dos veces duplica datos.

## Pruebas

`node:test`, sin framework:

- `backend/test/unit.test.js` — funciones puras: confianza, concurrencia, dedupe, extracción de JSON.
- `backend/test/api.test.js` — levanta el servidor real y ejercita rutas, validación, errores y SSE.

**Toda lógica de dominio nueva llega con su prueba.** Los criterios de
aceptación de un spec se cierran con una prueba que los verifique, no con una
inspección manual. Corré `npm test` antes de dar algo por terminado.

## Costo

El índice es compartido por una razón económica: descubrir por usuario costaría
$0.10–$0.50 por click y no habría negocio. Antes de agregar una llamada al
modelo, preguntate si se puede pre-filtrar en SQL — que es gratis — o si el
resultado se puede reusar desde el índice.

`MAX_SCORING_PER_RUN` existe para eso. No lo esquives.

## Antes de dar algo por terminado

- [ ] `npm test` en verde
- [ ] Ningún SQL fuera de `repositories/`
- [ ] Toda salida del modelo validada con Zod
- [ ] Ningún `catch` vacío
- [ ] Los comentarios explican por qué, no qué
- [ ] Si tocaste el esquema: hay `ALTER` idempotente o instrucciones de recrear
- [ ] Si cambiaste un contrato: el `.md` correspondiente quedó actualizado
