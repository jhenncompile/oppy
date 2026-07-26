# Specs

Cada feature que lo amerite se especifica antes de escribirse. Un spec son tres
archivos en `specs/NNN-nombre/`, y cada uno es entrada del siguiente:

```
spec.md     ── QUÉ y POR QUÉ.  Requisitos y criterios verificables. Sin stack.
design.md   ── CÓMO.           Arquitectura, contratos, archivos que se tocan.
tasks.md    ── EN QUÉ ORDEN.   Tareas ejecutables, cada una con su prueba.
```

No se avanza de archivo sin que el anterior esté acordado. Ese es el punto de
todo esto: encontrar el desacuerdo cuando cuesta un párrafo, no cuando cuesta
un refactor.

## Cuándo escribir un spec

**Sí**, cuando la feature:

- cruza más de un módulo del grafo de `docs/03-modulos.md`,
- toca el esquema de oportunidad (el contrato central congelado),
- cambia el esquema de base de datos,
- introduce una dependencia externa nueva,
- o pone en tensión una de las cuatro decisiones de [`CLAUDE.md`](../CLAUDE.md).

**No**, para arreglos acotados, cambios de un solo archivo, ajustes de copy o de
estilos. Escribirles un spec es fricción sin retorno.

## El loop

| Paso | Comando | Produce |
|------|---------|---------|
| 1 | `/spec <idea>` | `spec.md` — requisitos y criterios de "Hecho cuando" |
| 2 | `/spec-design <NNN>` | `design.md` — decisiones técnicas y archivos afectados |
| 3 | `/spec-tasks <NNN>` | `tasks.md` — tareas con checkbox y prueba asociada |
| 4 | *implementar* | código + pruebas, marcando tareas |
| 5 | `/spec-verify <NNN>` | contraste código vs. spec: qué está hecho, qué derivó |

El paso 5 es el que evita que esto se pudra. Un spec que nadie contrasta con el
código es documentación muerta en dos semanas.

## Convenciones

- **Numeración correlativa**, tres dígitos: `001-`, `002-`. No se reusan números
  aunque un spec se abandone.
- **Los requisitos usan "Hecho cuando:"**, la misma convención de
  `docs/07-plan-ejecucion.md`. Si un criterio no se puede verificar corriendo
  algo, está mal escrito.
- **Cada criterio se cierra con una prueba** en `backend/test/`. El spec anota
  cuál.
- **`docs/` no se toca desde un spec.** `docs/` es el porqué del producto y
  cambia por decisión de producto, no como efecto secundario de una feature. Si
  un spec contradice `docs/`, se resuelve la contradicción antes de implementar.
- **Un spec terminado no se borra.** Queda como registro de por qué el código es
  así; `tasks.md` con todo marcado es su estado final.

## Estado

| # | Feature | Estado |
|---|---------|--------|
| — | — | Todavía no hay specs. El primero se crea con `/spec`. |

Candidatos naturales (roadmap del README): feedback loop persistente, matching
inverso expuesto por API, notificaciones por WhatsApp, portal para
organizaciones, más de cinco fuentes.

Las plantillas están en [`_plantilla/`](_plantilla/).
