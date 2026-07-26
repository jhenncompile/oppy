# Fase 10 — Contrato del agente

Documento para quien construye el agente. **Se puede leer sin saber nada de la
interfaz**, y esa es la intención: el agente solo piensa en qué recibe, qué hace
y qué devuelve.

La frontera del lado del producto está en [`09-flujo-producto.md`](09-flujo-producto.md).

## Las tres reglas de la frontera

1. **El agente no crea el perfil.** Lo construye el frontend, lo guarda el
   backend, y el agente lo recibe como contexto. Si el agente le pregunta al
   usuario quién es, la frontera se rompió.
2. **El agente no devuelve texto para pintar.** Devuelve objetos estructurados.
   Cómo se ven en pantalla no es su problema.
3. **El agente es uno solo hacia afuera.** Los siete roles de abajo son
   organización interna. El usuario nunca los ve, ni los nombra, ni elige entre
   ellos.

---

# Entrada

El backend arma un sobre con tres cosas y lo entrega. Siempre las tres.

## 1. Perfil

```json
{
  "id": "uuid",
  "nombre": "María",
  "edad": 48,
  "ubicacion": "Santa Cruz, Bolivia",
  "idioma": "es",
  "objetivos": ["reinsercion", "curso"],

  "experiencia": ["administracion", "atencion_al_cliente", "experiencia_familiar"],
  "habilidades": ["comunicacion", "ventas", "organizacion"],
  "idiomas": [{ "idioma": "espanol", "nivel": "nativo" }],

  "preferencias": { "modalidad": "presencial", "radio_km": 10 },
  "restricciones": ["horario_manana"]
}
```

`objetivos` es la señal más fuerte: acota qué buscar **antes** de mirar el resto.
Es un arreglo de 1 a 3 y **el orden importa** — el primero es el principal y el
plan debe cubrirlo antes que los demás, sin repartir todo en partes iguales.

`restricciones` no es decorativo. Una convocatoria que cumple todos los
requisitos pero queda fuera del radio o del horario **no es elegible**, y el
puntaje tiene que reflejarlo.

## 2. Contexto

El historial es lo que hace que el agente mejore sin entrenar nada:

```json
{
  "guardadas": ["uuid"],
  "descartadas": ["uuid"],
  "aplicadas": ["uuid"],
  "ya_evaluadas": ["uuid"],
  "categorias_frecuentes": ["beca", "curso"]
}
```

`ya_evaluadas` no es opcional: sin eso, cada corrida vuelve a puntuar lo mismo y
el costo por usuario deja de ser marginal.

## 3. Evento

Qué provocó esta ejecución. Ver [Eventos](#eventos).

---

# Los siete roles

Son roles, no procesos separados. Buena parte ya existe en el repositorio bajo
otro nombre — la columna de la derecha evita reescribir lo construido.

| # | Rol | Qué decide | Dónde vive hoy | Estado |
|---|-----|-----------|----------------|--------|
| 0 | **Orquestador** | Qué buscar y dónde, para *este* perfil | `services/agent/orchestrator.js` | ✅ |
| 1 | **Explorer** | Ejecuta la búsqueda sobre las fuentes, en paralelo | `services/scraping/discovery.js` | ✅ |
| 2 | **Analyzer** | Qué es una convocatoria y qué es ruido; la estructura | `services/agent/normalizer.js` | ✅ |
| 3 | **Validation** | Si la fuente y el plazo son confiables | `services/scoring/trust.js` | ✅ |
| 4 | **Matching** | Si la persona **realmente** califica, y qué le falta | `services/scoring/matcher.js` | ◐ falta `brechas[]` |
| 5 | **Recommendation** | Cuáles mostrar y en qué orden | `opportunityRepository.findCandidatas` | ◐ pre-filtra en SQL; falta la priorización final |
| 6 | **Follow-up** | Qué recordar y cuándo | — | ○ |
| 7 | **Growth** | Qué patrón hay en lo descartado, y qué curso lo cierra | — | ○ |
| 8 | **Notificador** | A quién avisar y de qué, sin volverse spam | `jobs/notificacionesJob.js` + `services/notifications/` | ✅ |

El rol 0 no estaba en la propuesta original pero ya está construido y es el que
sostiene el argumento del track: **las queries no están escritas en el código**,
las decide el modelo a partir del perfil.

## Validation es código, no modelo

El semáforo de confianza sale de reglas explícitas y auditables — lista blanca
de dominios oficiales y vigencia del plazo — **no del criterio del LLM**:

🟢 Verificada · 🟡 Por validar · 🔴 Desactualizada

Es deliberado y no se negocia. Si el modelo pudiera otorgar el 🟢, el semáforo
no valdría nada, y es la única diferenciación que un directorio no puede copiar
rápido. Un patrocinio se marca en la interfaz y **nunca** altera el puntaje ni
la confianza.

## Recommendation prioriza, no lista

No devolver 300. El top se arma por compatibilidad, cercanía del plazo, impacto
y preferencias del usuario. El pre-filtrado barato pasa en SQL antes de gastar
una sola llamada al modelo: eso es lo que hace que el costo por usuario sea de
centavos y no de dólares.

---

# Salida

Siempre estructurada. Nunca solo texto.

```json
{
  "recomendaciones": [
    {
      "opportunity_id": "uuid",
      "compatibilidad": 92,
      "elegible": true,
      "razones": [
        "Tu experiencia administrativa cubre lo que piden",
        "Queda a 6 km de tu zona",
        "El horario de mañana coincide con tu disponibilidad"
      ],
      "brechas": ["Certificado de inglés B1"],
      "estado": "nuevo"
    }
  ],
  "recordatorios": [
    { "opportunity_id": "uuid", "tipo": "cierre_proximo", "en": "2027-03-14", "mensaje": "La convocatoria cierra en tres días." }
  ],
  "acciones": [
    { "opportunity_id": "uuid", "tipo": "checklist_pendiente", "detalle": "Falta la carta de motivación." }
  ],
  "cursos_recomendados": []
}
```

**`razones` es un arreglo, no un párrafo.** Entre 1 y 3 motivos concretos, cada
uno una frase corta que menciona un requisito real de la convocatoria. Nada de
generalidades como "es una buena oportunidad": si la razón no se puede
contrastar contra el texto de la convocatoria, no es una razón.

**`brechas` es lo que convierte una recomendación en algo accionable.** Va
redactada como una acción concreta — "certificado de inglés B1", no "mejorar el
inglés" — porque alimenta directamente el checklist del usuario y es la entrada
del rol Growth. Vacía si no le falta nada.

Los nombres anteriores (`match_score`, `por_que_calza`) ya no existen en ningún
lado: la migración está en `backend/src/db/schema.sql`.

---

# Eventos

El agente es **event-driven**, no conversacional. El backend dispara, el agente
responde. Así trabaja aunque el usuario no esté conectado — que es literalmente
lo que se le pide a un agente autónomo.

| Evento | Cuándo | Qué hace el agente | Estado |
|---|---|---|---|
| `user_created` | Perfil creado | Primeras recomendaciones | ◐ hoy es un botón |
| `profile_updated` | El usuario editó su perfil | Recalcula compatibilidad sobre el índice existente, **sin volver a scrapear** | ○ |
| `daily_scan` | Cron | Descubre para todos y alimenta el índice | ✅ |
| `opportunity_saved` | El usuario guardó algo | Inicia seguimiento y busca similares | ○ |
| `deadline_near` | Se acerca un plazo | Genera recordatorio | ○ |
| `match_alto` | Un match supera `NOTIF_MATCH_THRESHOLD` | Avisa por Zavu, con fallback de canal | ✅ `jobs/notificacionesJob.js` |
| `opportunity_closed` | Venció o cerró | Deja de recomendarla y busca alternativas | ◐ existe `marcarVencidas()`; falta la alternativa |

`profile_updated` es el que más valor da por línea escrita: como descubrimiento
y razonamiento están desacoplados, recalcular no cuesta una corrida completa —
solo matching sobre candidatas ya indexadas.

---

# Invariantes que el agente no puede romper

Están en [`CLAUDE.md`](../CLAUDE.md) y aplican a cualquier código nuevo:

- **Toda salida estructurada del modelo cruza un schema de Zod.** Lo que no lo
  cruza, no entra al sistema. Se reintenta una vez devolviéndole el error al
  modelo.
- **Nada tumba una corrida.** Los clientes de scraping y búsqueda nunca lanzan:
  devuelven vacío y lo registran. Que respondan 3 de 5 fuentes es un éxito.
- **El scoring es simétrico.** `evaluar(perfil, oportunidad)` no sabe quién es
  el "usuario", así que el matching inverso — una empresa buscando talento —
  reusa el mismo motor sin reescribirlo.
- **Un solo camino de código, dos disparadores.** El botón y el cron ejecutan el
  mismo pipeline; la corrida autónoma no puede divergir de lo que se demuestra
  en vivo.
- **El LLM vive detrás de una interfaz** (`services/llm/index.js`). Ningún
  módulo importa un proveedor directo.
- **El SQL vive solo en `repositories/`.**

---

# Lo que el agente nunca hace

- Crear o pedir el perfil del usuario
- Devolver HTML, markdown o texto listo para pintar
- Decidir el nivel de confianza de una fuente *(eso es código)*
- Alterar un puntaje por patrocinio
- Postular en nombre del usuario, gestionar sus documentos o construirle un CV

---

# Progreso en vivo

Cada paso del agente se emite por SSE mientras corre
(`GET /api/agent/runs/:id/stream`). No es un adorno: es la prueba visible de que
hay un agente decidiendo, y sostiene el 15% de la rúbrica que evalúa la demo.

Cada corrida queda además en la bitácora `agent_runs` — la respuesta auditable a
"¿y esto corre solo?".
