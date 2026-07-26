# Fase 8 — Casos de uso de la plataforma

Los documentos [1](01-problema.md) y [2](02-solucion.md) definen **un** flujo:
una persona busca oportunidades. El [6](06-modelo-negocio.md) describe seis
líneas de ingreso, pero como productos comerciales, no como casos de uso.

Este documento cierra esa brecha: quién dispara cada caso, **qué decide el
agente** en él, qué entrega, y qué existe hoy en el código. Es la vista de
plataforma que hasta ahora estaba implícita.

Regla que ordena todo lo demás: **un solo motor, varias entradas**. Ningún caso
de uso justifica un segundo pipeline. Si un caso exige razonar sobre
compatibilidad, usa `evaluar(perfil, oportunidad)` — que es simétrico a
propósito.

---

## Actores

| Actor | Quién es | Qué obtiene | ¿Paga? |
|-------|----------|-------------|--------|
| **Persona** | Estudiante, egresado, alguien reinsertándose al mercado | Oportunidades que realmente aplican, con el porqué | **Nunca** |
| **Organización** | Empresa, fundación, aceleradora | Llegar a perfiles que califican; talento | Sí |
| **Institución** | Universidad, gobierno, cooperación | Evidencia sobre la brecha formación ↔ mercado | Sí |
| **Agente** | El sistema corriendo solo | Mantiene el índice vivo y verificado | — |

El Agente es un actor, no una capa. Es el único que actúa sin que nadie se lo
pida, y eso es lo que separa a Oppy de un directorio.

---

## Catálogo de casos de uso

Estado: **✅ existe** · **◐ parcial** — el motor está, falta la superficie ·
**○ falta** — no hay nada todavía.

### Persona

| ID | Caso de uso | Disparador | Qué **decide** el agente | Entrega | Módulo | Estado |
|----|-------------|-----------|--------------------------|---------|--------|--------|
| CU-01 | Crear mi perfil | La persona | — (captura) | Perfil persistido | M1 | ✅ `POST /api/profiles` |
| CU-02 | Buscar oportunidades para mí | La persona | Qué buscar y dónde, según *este* perfil | `runId` + corrida en marcha | M2–M6 | ✅ `POST /api/agent/run` |
| CU-03 | Ver al agente trabajando | CU-02 | — (narra sus propias decisiones) | Stream de pasos en vivo | M7 | ✅ SSE `/runs/:id/stream` |
| CU-04 | Leer por qué una oportunidad calza conmigo | CU-02 | Elegibilidad real, no keywords | `compatibilidad` + `razones[]` + `brechas[]` | M5 | ✅ `GET /api/matches` |
| CU-05 | Saber si puedo confiar en la fuente | CU-04 | — (regla explícita, **no** criterio del modelo) | 🟢🟡🔴 + fuente + fecha | M6 | ✅ `services/scoring/trust.js` |
| CU-06 | Guardar o descartar | La persona | — | Estado persistido | M7 | ✅ `PATCH /api/matches/:id` |
| CU-07 | Enterarme de algo nuevo sin entrar | Cron | Qué apareció desde la última vez que aplique a mí | Notificación accionable | M12 | ○ falta |
| CU-08 | Usar Oppy sin poder ver la pantalla | La persona | — | Onboarding y resumen hablados | M9 | ○ falta |
| CU-09 | Hacerme visible para empresas | La persona | — | Consentimiento registrado y revocable | M1 | ✅ `PATCH /profiles/:id/visibilidad` |

### Organización

| ID | Caso de uso | Disparador | Qué **decide** el agente | Entrega | Estado |
|----|-------------|-----------|--------------------------|---------|--------|
| CU-10 | Publicar mi convocatoria verificada | La organización | — (entra al índice por la misma puerta, cambia `origen`) | Convocatoria 🟢 en el índice | ◐ el esquema lo soporta (`origen`, `org_id`), no hay endpoint |
| CU-11 | Buscar talento que califique | La organización | Compatibilidad, con los roles invertidos | Candidatos + `razones[]` | ◐ el motor ya es simétrico, no hay endpoint |
| CU-12 | Medir si mi convocatoria llegó | La organización | — (agrega telemetría) | Reporte: vistas, carreras, ciudades, clics | ◐ tabla `events` existe, no hay reporte |
| CU-13 | Patrocinar el acceso de una población | La organización | — | Reporte de impacto auditable | ○ falta |

### Institución

| ID | Caso de uso | Disparador | Qué **decide** el agente | Entrega | Estado |
|----|-------------|-----------|--------------------------|---------|--------|
| CU-14 | Saber qué habilidades pide el mercado | La institución | — (agrega `skills[]` del índice) | Ranking de habilidades más pedidas | ✅ `GET /api/insights/skills` |
| CU-15 | Embeber Oppy para mis estudiantes | La institución | Todo el loop, sobre su población | Instancia o API dedicada | ○ falta |

### Agente (autónomo)

| ID | Caso de uso | Disparador | Qué **decide** el agente | Entrega | Estado |
|----|-------------|-----------|--------------------------|---------|--------|
| CU-16 | Mantener el índice vivo | Cron diario | Qué buscar hoy, qué es nuevo, qué está duplicado | Índice actualizado | ✅ `jobs/runner.js` + `render.yaml` |
| CU-17 | Marcar lo que venció | Cron | — (regla de fecha) | Convocatorias a `vencida` | ✅ `marcarVencidas()` |
| CU-18 | Dejar constancia de que corrió solo | Cada corrida | — | Bitácora auditable | ✅ `GET /api/agent/runs` |

---

## Dónde decide el agente de verdad

El brief del track es explícito: *"Wrapper de API con un prompt, sin decisiones
reales"* no se acepta. Vale la pena tener localizado, para el pitch, dónde hay
decisión y dónde no:

| Decisión real del LLM | Dónde | Por qué cuenta |
|---|---|---|
| Qué buscar y dónde, para *este* perfil | `orchestrator.planificar()` | Las queries **no** están escritas en el código |
| Qué es una convocatoria y qué es ruido | `normalizer.normalizar()` | Extrae de páginas sin estructura común |
| Si la persona **realmente** califica | `matcher.evaluar()` | Razona sobre requisitos, no coincide palabras |

Y, a propósito, dónde **no** decide el modelo:

- **La confianza es código** (`trust.js`): lista blanca de dominios y vigencia
  del plazo. Auditable por cualquiera. Si el modelo pudiera otorgar el 🟢, el
  semáforo no valdría nada.
- **El ranking no se compra**: `sponsored` se marca en la interfaz y no toca
  `compatibilidad` ni `confianza`.

---

## Casos de uso ↔ líneas de ingreso

| Producto de [`06-modelo-negocio`](06-modelo-negocio.md) | Casos de uso que lo hacen posible |
|---|---|
| 1. Publicación verificada | CU-10, CU-05 |
| 2. Matching inverso | CU-11, CU-09 *(el consentimiento es precondición dura)* |
| 3. Marca empleadora | CU-12 |
| 4. Inteligencia de oportunidades | CU-14, CU-16 |
| 5. Oppy Impacto (RSE) | CU-13, CU-12 |
| 6. API / white-label | CU-15 |

Lectura útil: **CU-16 alimenta a los seis**. El cron no es un extra del pitch;
es el productor del único activo que no se puede copiar rápido.

---

## Prioridad

`DEMO` = se ve en vivo en los 4 minutos · `PITCH` = se cuenta, no se construye ·
`POST` = después del evento.

| Prioridad | Casos de uso | Justificación |
|-----------|--------------|---------------|
| **DEMO** | CU-01 → CU-06, CU-16, CU-18 | Es el flujo completo del pitch, y todo ya existe en código |
| **PITCH** | CU-11, CU-14, CU-10 | El motor simétrico y el endpoint de habilidades ya están: se muestran, no se construyen |
| **POST** | CU-07, CU-08, CU-12, CU-13, CU-15, CU-17 | Ninguno cambia el esquema de datos, así que ninguno urge |

Nada en la columna POST obliga a migrar la base. Eso es consecuencia directa de
haber puesto `skills[]`, `events`, `consents` y `orgs` desde el principio.

---

## Lo que sigue sin decidirse

Cinco decisiones de negocio reales. Ninguna bloquea las próximas horas — todas
bloquean la semana siguiente.

| # | Decisión | Recomendación | Por qué |
|---|----------|---------------|---------|
| D1 | ¿Producto de consumo con B2B encima, o plataforma B2B2C desde el día uno? | **Consumo primero** | Sin masa de perfiles, CU-11 y CU-12 no tienen qué vender |
| D2 | ¿Cuál es el primer cliente que paga? | **Publicación verificada (CU-10)** | `06` ya lo marca como "el más rápido de vender", y el esquema ya lo soporta |
| D3 | ¿El opt-in de matching inverso entra al MVP? | **Sí, el backend; la UI después** | `CU-09` ya está implementado; sin él, el activo de perfiles no se acumula desde el día uno |
| D4 | ¿Bolivia o LatAm? | **Bolivia** | La diferenciación entera es "nadie indexa fuentes bolivianas". Abrir el alcance la diluye |
| D5 | ¿Se acepta contenido patrocinado en el MVP? | **Sí, marcado y sin afectar el puntaje** | El campo ya existe; la regla ya está escrita. Postergarlo no ahorra trabajo |

---

## Lo que explícitamente no es un caso de uso

Repetido de [`01-problema`](01-problema.md) porque es donde más presión hay para
agregar alcance: postular por el usuario, gestionar documentos, construir CV,
red social, pagos, y cobertura exhaustiva del mercado laboral.

Agregar cualquiera de estos convierte a Oppy en otro producto.
