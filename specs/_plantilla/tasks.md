# NNN — Tareas

Entrada: [`design.md`](design.md). Orden de implementación, de abajo hacia
arriba: primero lo que no depende de nada, al final lo visible.

Cada tarea es un commit razonable. Si una tarea no entra en un commit, se parte.

## Leyenda

- `[ ]` pendiente · `[~]` en curso · `[x]` hecha
- **R#** — requisito de `spec.md` que la tarea ayuda a cerrar
- *prueba* — qué prueba la verifica (o `manual:` con el paso exacto, si no hay)

## Tareas

- [ ] **T1** — <acción concreta>
      **R1** · `backend/src/...`
      *prueba:* `unit.test.js` — <qué asegura>

- [ ] **T2** — <acción concreta>
      **R1, R2** · `backend/src/...`
      *prueba:* `api.test.js` — <qué asegura>

- [ ] **T3** — <acción concreta>
      **R2** · `frontend/src/...`
      *prueba:* `manual:` <paso exacto para verificarlo>

## Cierre

Un requisito no se marca cerrado hasta que su prueba pasa.

| Requisito | Tareas | Cerrado |
|-----------|--------|---------|
| R1 | T1, T2 | [ ] |
| R2 | T2, T3 | [ ] |

## Derivas

Lo que se decidió distinto del diseño durante la implementación, y por qué. Se
completa sobre la marcha; `/spec-verify` lo revisa. Si una deriva invalida una
decisión de `design.md`, se corrige el diseño — no se deja la contradicción.
