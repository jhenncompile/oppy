# NNN — <nombre de la feature>

**Estado:** borrador | acordado | en implementación | terminado
**Módulos que toca:** <M1..M12 de docs/03-modulos.md>

## Problema

Qué le duele hoy a quién. Dos o tres frases, en términos de la persona que usa
Oppy o de la organización que publica — no en términos de código.

## Por qué ahora

Qué cambia si esto existe, y qué pasa si no se hace. Si la respuesta es "nada
grave", el spec sobra.

## Fuera de alcance

Lo que explícitamente **no** entra. Esta sección es la que evita que la feature
crezca durante la implementación. Sé concreto: nombrá lo que alguien
razonablemente asumiría que está incluido y no lo está.

## Requisitos

Numerados, verificables, sin decisiones de stack. Cada uno con su condición de
hecho.

### R1 — <título>

Como <perfil / organización / el sistema>, necesito <capacidad> para <fin>.

*Hecho cuando:* <condición observable — una llamada que devuelve algo concreto,
una fila que aparece, una pantalla que muestra tal cosa>.

### R2 — <título>

...

*Hecho cuando:* ...

## Casos límite

Qué pasa cuando el LLM devuelve basura, cuando la fuente no responde, cuando no
hay datos, cuando el plazo ya venció, cuando el usuario no dio consentimiento.
En Oppy esto no es opcional: **nada tumba una corrida**.

## Impacto sobre las decisiones que no se negocian

Recorré las cuatro de `CLAUDE.md` y decí si esta feature las respeta, o cuál
tensiona y por qué vale la pena.

1. Demostrar agencia, no búsqueda —
2. El índice es compartido —
3. La confianza es código —
4. Un solo camino de código, dos disparadores —

## Preguntas abiertas

Lo que hay que resolver antes de pasar a `design.md`. Si esta sección no está
vacía, el spec no está acordado.
