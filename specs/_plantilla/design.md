# NNN — Diseño

Entrada: [`spec.md`](spec.md). Este archivo no reabre el *qué*: si algo del
spec resulta imposible o caro de más, se corrige el spec y se vuelve acá.

## Enfoque

El cómo, en un párrafo, antes del detalle. Dónde vive la lógica nueva y por qué
ahí y no en otro lado.

## Decisiones

Solo las que tienen alternativa real. Una tabla, no un ensayo.

| Decisión | Alternativa descartada | Por qué |
|----------|------------------------|---------|
| | | |

## Flujo

```
<diagrama de texto: de dónde sale el dato, por qué módulos pasa, dónde queda>
```

## Contratos

Formas de datos nuevas o modificadas. Si toca el esquema de oportunidad
(congelado en `docs/03-modulos.md`), decilo acá en primer lugar y enumerá todo
lo que hay que mover en el mismo movimiento.

```json
{}
```

Endpoints nuevos o cambiados:

| Método | Ruta | Entrada | Salida | Errores |
|--------|------|---------|--------|---------|
| | | | | |

## Base de datos

Migración necesaria, si la hay. El esquema es idempotente: el cambio se escribe
para poder correrse dos veces sin romper nada.

```sql
```

## Archivos

| Archivo | Qué cambia |
|---------|------------|
| `backend/src/...` | nuevo / modificado — qué |

## Errores y degradación

Qué falla, cómo se degrada. Los clientes externos no lanzan: devuelven vacío y
lo registran. Qué se ve en la interfaz cuando el camino feliz no ocurre.

## Cómo se prueba

Qué se cubre con prueba unitaria (`unit.test.js`, funciones puras) y qué con
integración (`api.test.js`, servidor real). Si algo no se puede probar sin la
red o sin el modelo, decí cómo se aísla.

## Riesgos

Lo que puede salir mal en implementación y qué haríamos.
