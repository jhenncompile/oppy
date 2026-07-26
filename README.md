# Oppy

Agente de IA que descubre, verifica y recomienda oportunidades — becas,
pasantias, empleos, concursos y financiamiento — para jovenes en Bolivia, y te
explica **por que** cada una calza con tu perfil.

> Oppy no busca oportunidades para llenar vacantes; busca oportunidades para
> que las personas puedan avanzar.

## Setup

```bash
# 1. Clonar e instalar
git clone <repo> && cd Oppy
npm install --prefix backend && npm install --prefix frontend

# 2. Configurar el entorno
cp backend/.env.example backend/.env      # DATABASE_URL, EXA_API_KEY, FIRECRAWL_API_KEY
cp frontend/.env.example frontend/.env

# 3. Crear el esquema y perfiles de prueba
npm run migrate --prefix backend
npm run seed --prefix backend

# 4. Levantar
npm run dev --prefix backend              # http://localhost:3001
npm run dev --prefix frontend             # http://localhost:5173
```

Requiere Node 20+, PostgreSQL y un modelo servido por Ollama.

## Arquitectura

```
Perfil (4 campos)
      │
      ▼
Orquestador ── decide QUE buscar y DONDE segun el perfil
      │
      ▼
Explorador ── busqueda semantica (Exa) + scraping (Firecrawl), en paralelo
      │
      ▼
Normalizador ── LLM → esquema comun + skills[] + dedupe por hash
      │
      ▼
INDICE COMPARTIDO (opportunities)  ◄──── cron diario
      │
      ▼
Analista ── razona elegibilidad real → match_score + por_que_calza
      │
      ▼
matches (por persona) ──► Dashboard + stream de progreso en vivo (SSE)
```

**La decision estructural**: el indice es **compartido**. El cron descubre una
vez para todos; el matching por persona es una sola llamada barata sobre
candidatas pre-filtradas en SQL. Con busqueda por usuario, cada click costaria
entre $0.10 y $0.50 y no habria negocio posible ni siendo gratuito.

Consecuencia: descubrimiento y razonamiento quedan desacoplados — se puede
reejecutar el matching sin volver a scrapear.

### Estructura

```
backend/src/
  config/         entorno validado con Zod, falla al arrancar si algo falta
  db/             pool, esquema idempotente, migracion, seed
  repositories/   unico lugar con SQL
  services/
    llm/          proveedor intercambiable + salida JSON validada
    scraping/     fuentes declarativas, Exa, Firecrawl, descubrimiento paralelo
    scoring/      semaforo de confianza + evaluador simetrico de compatibilidad
    agent/        orquestador, normalizador, pipeline, progreso en vivo
  routes/         HTTP, sin logica de negocio
  jobs/           corrida autonoma (cron embebido o proceso aparte)
frontend/src/
  styles/         tokens espejo de las variables de Figma
  components/     badge de confianza, barra de score, card, proceso en vivo
```

## Decisiones que vale la pena conocer

**El LLM esta detras de una interfaz** (`services/llm`). Cambiar de proveedor es
configuracion, no refactor. Toda salida estructurada se valida contra un schema
de Zod y se reintenta una vez: lo que no cruza el schema no entra al sistema.

**Las fuentes son datos, no codigo** (`services/scraping/sources.js`). Agregar
una fuente es agregar un objeto. Ese es el argumento concreto de escalabilidad.

**Nada tumba una corrida.** Los clientes de scraping y busqueda nunca lanzan;
devuelven vacio y lo registran. Que respondan 3 de 5 fuentes es un exito.

**El scoring es simetrico.** `evaluar(perfil, oportunidad)` no sabe quien es el
"usuario", asi que el matching inverso — una empresa buscando talento — reusa el
mismo motor sin reescribirlo.

**La confianza es codigo, no criterio del modelo.** El semaforo sale de reglas
explicitas y auditables (`services/scoring/trust.js`): lista blanca de dominios
oficiales y vigencia del plazo. Una oportunidad patrocinada se marca en la
interfaz y **nunca** altera su puntaje ni su nivel de confianza.

**Un solo camino de codigo, dos disparadores.** El boton del dashboard y el cron
ejecutan el mismo pipeline, asi la corrida autonoma no puede divergir de lo que
se demuestra en vivo.

## API

| Metodo | Ruta | Que hace |
|--------|------|----------|
| `POST` | `/api/profiles` | Crea un perfil (4 campos) |
| `PATCH` | `/api/profiles/:id/visibilidad` | Opt-in del matching inverso, con consentimiento registrado |
| `POST` | `/api/agent/run` | Dispara una corrida, devuelve `runId` de inmediato |
| `GET` | `/api/agent/runs/:id/stream` | Progreso en vivo por SSE |
| `GET` | `/api/agent/runs` | Bitacora de corridas — la prueba de autonomia |
| `GET` | `/api/matches?userId=` | Recomendaciones ordenadas por compatibilidad |
| `PATCH` | `/api/matches/:id` | Guardar / descartar |
| `GET` | `/api/opportunities` | El indice compartido, sin personalizar |
| `POST` | `/api/events` | Telemetria de producto |
| `GET` | `/api/insights/skills` | Habilidades mas pedidas — inteligencia de oportunidades |
| `GET` | `/health` | Estado y capacidades activas |

## Pruebas

```bash
npm test --prefix backend
```

31 pruebas: clasificacion de confianza, limite de concurrencia, deduplicacion
de convocatorias y de busquedas, extraccion de JSON de respuestas del modelo, y
una bateria de integracion que levanta el servidor real y ejercita rutas,
validacion, manejo de errores y streaming SSE.

## Que es real y que es roadmap

**Funciona hoy**: descubrimiento sobre fuentes bolivianas, normalizacion con
`skills[]`, indice compartido con deduplicacion, scoring con justificacion,
semaforo de confianza, dashboard, progreso en vivo, corrida autonoma por cron,
telemetria, y el endpoint de habilidades mas pedidas.

**Roadmap**: notificaciones por WhatsApp, feedback loop persistente, matching
inverso expuesto por API, portal para organizaciones, mas de cinco fuentes.

## Despliegue

`render.yaml` define la API, el cron y la base. `frontend/netlify.toml` define
el frontend. El cron embebido (`CRON_ENABLED=true`) y el cron job de Render son
alternativas: activar los dos duplicaria el descubrimiento.

## Documentacion

El razonamiento de producto vive en [`docs/`](docs/): problema, solucion,
modulos, diseno, desarrollo, modelo de negocio y plan de ejecucion.
