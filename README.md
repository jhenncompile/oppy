# Oppy

Agente de IA que descubre, verifica y recomienda oportunidades — becas,
pasantias, empleos, concursos y financiamiento — para jovenes en Bolivia, y te
explica **por que** cada una calza con tu perfil.

> Oppy no busca oportunidades para llenar vacantes; busca oportunidades para
> que las personas puedan avanzar.

## Setup

Requiere Node 20+, PostgreSQL corriendo en local y un modelo servido por
Ollama.

```bash
git clone <repo> && cd Oppy
npm start
```

`npm start` abre un menu con las tres cosas que hay que hacer:

```
Oppy — entorno local
  entorno sin preparar — empieza por la opcion 1

  1) Preparar el entorno     .env, base de datos, esquema, datos demo
  2) Levantar el backend     http://localhost:3001
  3) Levantar el frontend    http://localhost:5173
  0) Salir
```

**Opcion 1** instala dependencias, escribe los `.env` (pregunta la contrasena de
PostgreSQL sin mostrarla en pantalla), crea la base si falta, aplica el esquema,
siembra perfiles de prueba y verifica que Ollama responda. Es idempotente: se
puede elegir las veces que haga falta. No pisa un `.env` existente sin
preguntar, ni vuelve a sembrar si ya hay perfiles — `seed` inserta sin upsert,
asi que correrlo dos veces duplicaria los datos.

**Opciones 2 y 3** van en **terminales separadas**: se abre esta herramienta en
cada una y se elige 2 en una, 3 en la otra. Estan aparte a proposito — son dos
servicios distintos tambien en despliegue (Render y Netlify), y separados se
reinicia o se leen los logs de uno sin tocar el otro. `Ctrl+C` baja el servicio
y devuelve al menu.

Cada opcion tambien es invocable directamente, sin pasar por el menu:

```bash
npm run setup     # opcion 1     (node scripts/oppy.mjs preparar)
npm run dev:api   # opcion 2     (node scripts/oppy.mjs backend)
npm run dev:web   # opcion 3     (node scripts/oppy.mjs frontend)
```

Sin Ollama la API y el dashboard levantan igual; lo que falla es
`POST /api/agent/run`, que es donde entran el normalizador y el scoring.

<details>
<summary>Los mismos pasos, a mano</summary>

```bash
npm install --prefix backend && npm install --prefix frontend

cp backend/.env.example backend/.env      # DATABASE_URL, EXA_API_KEY, FIRECRAWL_API_KEY
cp frontend/.env.example frontend/.env

createdb oppy
npm run migrate --prefix backend
npm run seed --prefix backend

ollama pull llama3.1:8b

npm run dev --prefix backend
npm run dev --prefix frontend
```

En Windows, `createdb` suele no estar en el PATH — la opcion 1 crea la base con
el cliente `pg` del backend justamente para no depender de eso.

</details>

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
Analista ── razona elegibilidad real → compatibilidad + razones + brechas
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

Las reglas de trabajo sobre el repo — decisiones que no se negocian, invariantes
de arquitectura, convenciones — estan en [`CLAUDE.md`](CLAUDE.md).

Las features que cruzan mas de un modulo o tocan el contrato central se
especifican antes de escribirse: el loop y las plantillas estan en
[`specs/`](specs/README.md).
