# Oppy

Agente de IA que descubre, verifica y recomienda oportunidades — becas,
pasantias, empleos, concursos y financiamiento — para jovenes en Bolivia, y te
explica **por que** cada una calza con tu perfil.

> Oppy no busca oportunidades para llenar vacantes; busca oportunidades para
> que las personas puedan avanzar.

## Setup

Requiere **Node 20+**, una base **PostgreSQL** (local o Supabase) y un modelo
servido por **Ollama**.

```bash
git clone <repo> && cd Oppy
npm start
```

`npm start` abre un menu con todo lo que hace falta:

```
Oppy — entorno local
  entorno sin preparar — empieza por la opcion 1

  1) Preparar el entorno       .env, base de datos, esquema, datos demo
  2) Levantar el backend       http://localhost:3001
  3) Levantar el frontend      http://localhost:5173
  4) Probar una notificacion   envio real por Zavu
  5) Correr el agente ahora    la misma corrida que el cron
  6) Limpiar datos de ejemplo  saca el catalogo demo del indice
  0) Salir
```

**Opcion 1** instala dependencias, escribe los `.env` (pregunta la contrasena
sin mostrarla en pantalla), crea la base si falta, aplica el esquema, siembra
perfiles de prueba y verifica que Ollama y Zavu respondan. Es idempotente: se
puede elegir las veces que haga falta. No pisa un `.env` existente sin
preguntar, ni vuelve a sembrar si ya hay perfiles — `seed` inserta sin upsert,
asi que correrlo dos veces duplicaria los datos.

Si la `DATABASE_URL` apunta a un host remoto, detecta que la base es gestionada
y omite el `CREATE DATABASE`: en Supabase no se crean bases, se usa la que ya
esta.

**Opciones 2 y 3** van en **terminales separadas**: se abre esta herramienta en
cada una y se elige 2 en una, 3 en la otra. Estan aparte a proposito — son dos
servicios distintos tambien en despliegue (Render y Netlify), y separados se
reinicia o se leen los logs de uno sin tocar el otro. `Ctrl+C` baja el servicio
y devuelve al menu.

**Opciones 4, 5 y 6** son las del dia del pitch. La 5 deja el indice poblado por
adelantado, asi la demo en vivo solo hace matching — rapido y a prueba de la red
del evento. La 4 confirma que el canal de notificaciones funciona antes de
demostrarlo, no durante. **La 6 hay que correrla antes de cualquier demo con
fuentes reales**: el catalogo de ejemplo entra al indice con nombres de fuente
autenticos y, una vez adentro, es indistinguible de una convocatoria de verdad.

Cada opcion tambien es invocable directamente, sin pasar por el menu:

```bash
npm run setup     # opcion 1     (node scripts/oppy.mjs preparar)
npm run dev:api   # opcion 2     (node scripts/oppy.mjs backend)
npm run dev:web   # opcion 3     (node scripts/oppy.mjs frontend)
npm run cron      # opcion 5     (node scripts/oppy.mjs agente)
```

Sin Ollama la API y el dashboard levantan igual: el scoring cae a un puntaje
heuristico por solapamiento de palabras, asi que se ven resultados aunque el
modelo no responda. Lo que se pierde es el razonamiento — las `razones` dejan de
mencionar requisitos concretos.

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
Perfil ── lo arma el frontend, nunca el agente
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
      │
      ▼
Notificaciones ── avisa por [Zavu](https://zavu.dev) lo que supera el umbral
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
    notifications/  cliente de Zavu + redaccion del mensaje
  routes/         HTTP, sin logica de negocio
  jobs/           corrida autonoma (cron embebido o proceso aparte)
frontend/src/
  styles/         tokens espejo de las variables de Figma, claro y oscuro
  components/     badge de confianza, barra de score, card, proceso en vivo,
                  navegacion, campos, logo
  hooks/          perfil en localStorage, matches compartidos, corrida en vivo
  pages/          las 9 vistas
```

## El frontend

Nueve vistas con router. **El centro no es un buscador: es un tablero.** Despues
del onboarding la persona no vuelve a buscar — el agente descubre solo y el
tablero se actualiza.

| | |
|---|---|
| **Portada** | quien ya tiene perfil entra directo |
| **Onboarding** | seis pasos, una pregunta grande por paso, borrador que sobrevive a un refresh |
| **Buscando** | la narracion del agente en vivo por SSE |
| **Oportunidades** | filtros por categoria, Top 5 y "ver las otras N" |
| **Detalle** | razones, brechas como checklist marcable, skills y fuente con fecha |
| **Mis oportunidades** | agrupado por estado, con lo que cierra pronto arriba |
| **Calendario** | proximos cierres por urgencia |
| **Mi perfil** | con el opt-in de visibilidad para organizaciones |
| **Acceso** | recuperar un perfil por codigo — ver [`docs/12-auth.md`](docs/12-auth.md) |

Navegacion lateral en escritorio y barra inferior en movil. **Sin menu
hamburguesa a proposito**: esta app la usa gente de 55 anios y gente con poca
practica digital, y un menu escondido detras de tres rayitas es exactamente la
barrera que Oppy existe para no poner.

La sesion es el `userId` en `localStorage` y nada mas: sin cuenta, sin
contrasena. Cada paso extra antes de ver el valor es gente que abandona.

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

## Notificaciones con Zavu

Cuando el agente encuentra algo que supera el umbral de compatibilidad, avisa
solo — desde el cron, no desde un boton. El canal lo resuelve
**[Zavu](https://zavu.dev)** ([docs](https://docs.zavu.dev)), la API unificada
de mensajeria: elige SMS, Telegram, Email o Voz segun el formato del
destinatario y reintenta por otro si el primero falla.

No se fuerza un canal a mano a proposito. El fallback automatico de Zavu da mas
entregabilidad que cualquier logica de seleccion propia, y con menos codigo.

```
services/notifications/
  zavu.js        cliente + envio, devuelve un resultado normalizado
  templates.js   redaccion del mensaje — funcion pura, testeable sin red
jobs/
  notificacionesJob.js   filtra, envia y registra
```

Tres filtros antes de escribirle a alguien: consentimiento explicito y contacto
cargado, compatibilidad sobre `NOTIF_MATCH_THRESHOLD`, y que no se le haya
avisado antes de esa misma oportunidad. El `UNIQUE (user_id, opportunity_id)` de
la tabla `notificaciones` es lo que garantiza lo ultimo — sin eso, cada corrida
del cron reenviaria lo mismo y Oppy pasaria de acompaniante a spam en un dia.

Los fallos tambien se guardan: un envio que no salio es informacion. Y nada de
esto tumba una corrida — sin `ZAVUDEV_API_KEY` el modulo se degrada solo, igual
que Exa y Firecrawl.

Prueba manual antes de conectar nada:

```bash
cd backend && node scripts/test-zavu.js tu@correo.com
```

## API

| Metodo | Ruta | Que hace |
|--------|------|----------|
| `POST` | `/api/profiles` | Crea un perfil |
| `GET` | `/api/profiles/:id` | Recupera un perfil |
| `PATCH` | `/api/profiles/:id/visibilidad` | Opt-in del matching inverso, con consentimiento registrado |
| `POST` | `/api/agent/run` | Dispara una corrida, devuelve `runId` de inmediato |
| `GET` | `/api/agent/runs/:id/stream` | Progreso en vivo por SSE |
| `GET` | `/api/agent/runs` | Bitacora de corridas — la prueba de autonomia |
| `GET` | `/api/matches?userId=` | Recomendaciones ordenadas por compatibilidad |
| `PATCH` | `/api/matches/:id` | Avanza el seguimiento o descarta |
| `GET` | `/api/opportunities` | El indice compartido, sin personalizar |
| `GET` | `/api/opportunities/:id` | Una convocatoria |
| `POST` | `/api/events` | Telemetria de producto |
| `GET` | `/api/insights/skills` | Habilidades mas pedidas — inteligencia de oportunidades |
| `GET` | `/api/insights/categorias` | Distribucion del indice |
| `GET` | `/health` | Estado y capacidades activas |

El perfil acepta `objetivos[]` (1 a 3, el primero pesa mas), `experiencia[]`,
`habilidades[]`, `restricciones[]`, `preferencias{}`, `edad` y contacto
(`email` / `telefono`) con `aceptaNotificaciones`. Todo opcional salvo carrera,
nivel de estudios y ubicacion.

El seguimiento avanza `guardado → preparando → aplicada → entrevista →
finalizada`; `descartado` se puede elegir en cualquier momento y es terminal.

**Pendiente**: los tres endpoints de acceso (`/api/auth/*`). El frontend ya esta
construido y los detecta ausentes por 404, asi que hoy esconde la funcionalidad
sola. Contrato en [`docs/12-auth.md`](docs/12-auth.md).

## Pruebas

```bash
npm test --prefix backend
```

50 pruebas con `node:test`, sin framework: clasificacion de confianza, limite de
concurrencia, deduplicacion de convocatorias y de busquedas, extraccion de JSON
de respuestas del modelo, plan del orquestador, redaccion de las notificaciones,
y una bateria de integracion que levanta el servidor real y ejercita rutas,
validacion, manejo de errores y streaming SSE.

## Que es real y que es roadmap

**Funciona hoy**: descubrimiento sobre fuentes bolivianas, normalizacion con
`skills[]`, indice compartido con deduplicacion, scoring con justificacion y
fallback heuristico cuando el modelo no responde, semaforo de confianza, las
nueve vistas del frontend con modo claro y oscuro, progreso en vivo por SSE,
corrida autonoma por cron, notificaciones por Zavu, telemetria, y los endpoints
de inteligencia de oportunidades.

**Roadmap**: acceso por codigo (frontend listo, backend pendiente), onboarding y
resumen por voz, feedback loop persistente, matching inverso expuesto por API,
portal para organizaciones, checklist y calendario persistidos en el servidor,
mas de cinco fuentes.

## Despliegue

`render.yaml` define la API y el cron; `frontend/netlify.toml` define el
frontend. El cron embebido (`CRON_ENABLED=true`) y el cron job de Render son
alternativas: activar los dos duplicaria el descubrimiento.

La base vive en Supabase y los dos servicios reciben la misma `DATABASE_URL` —
el indice de oportunidades es compartido, asi que apuntar a bases distintas
rompe la premisa. Los pasos estan en [`docs/11-supabase.md`](docs/11-supabase.md).

## Documentacion

El razonamiento de producto vive en [`docs/`](docs/):

| | |
|---|---|
| [`01`](docs/01-problema.md) · [`02`](docs/02-solucion.md) | problema y solucion |
| [`03`](docs/03-modulos.md) · [`04`](docs/04-diseno.md) · [`05`](docs/05-desarrollo.md) | modulos, diseno y desarrollo |
| [`06`](docs/06-modelo-negocio.md) · [`07`](docs/07-plan-ejecucion.md) | modelo de negocio y plan |
| [`08`](docs/08-casos-de-uso.md) | los 4 actores y que decide el agente en cada caso |
| [`09`](docs/09-flujo-producto.md) | lo que el usuario vive, y la frontera con el agente |
| [`10`](docs/10-contrato-agente.md) | que recibe, que hace y que devuelve el agente |
| [`11`](docs/11-supabase.md) · [`12`](docs/12-auth.md) | la base en Supabase y el contrato de acceso |

Los dos que mas se usan al construir: **[`10`](docs/10-contrato-agente.md)** se
lee sin saber nada de la interfaz, y **[`09`](docs/09-flujo-producto.md)** traza
la frontera — *si el frontend tuvo que decidir que oportunidad es mejor, invadio
al agente; si el agente devuelve texto para pintar, invadio al producto.*

Las reglas de trabajo sobre el repo — decisiones que no se negocian, invariantes
de arquitectura, convenciones — estan en [`CLAUDE.md`](CLAUDE.md).

Las features que cruzan mas de un modulo o tocan el contrato central se
especifican antes de escribirse: el loop y las plantillas estan en
[`specs/`](specs/README.md).
