# Oppy — Plan maestro

> **Oppy no busca oportunidades para llenar vacantes; busca oportunidades
> para que las personas puedan avanzar.**

Agente de IA que descubre, verifica y recomienda oportunidades (becas,
pasantías, empleos, cursos, financiamiento) según el perfil de cada persona.
Contexto inicial: Bolivia / LatAm. Entrega objetivo: **Cursor Buildathon
Bolivia 2026 — Bolivia Agents Track**.

Diseño: https://www.figma.com/design/q2aCurFwPXUrLeJKEX3Gl1/Oppy

## Documentos

| # | Documento | Qué resuelve |
|---|-----------|--------------|
| 1 | [Definición de problema](01-problema.md) | A quién le duele, cuánto, y cómo se mide |
| 2 | [Solución](02-solucion.md) | El loop del agente, los 4 roles, el alcance del MVP |
| 3 | [Módulos](03-modulos.md) | Descomposición técnica, dependencias, contratos |
| 4 | [Diseño](04-diseno.md) | Pantallas, card de oportunidad, accesibilidad |
| 5 | [Desarrollo](05-desarrollo.md) | Stack, riesgos, guion del pitch |
| 6 | [Modelo de negocio](06-modelo-negocio.md) | Índice compartido + qué se le vende a las empresas |
| 7 | [Plan de ejecución](07-plan-ejecucion.md) | Hitos H0–H8 con condición de "hecho" |
| 8 | [Casos de uso](08-casos-de-uso.md) | Los 4 actores, qué decide el agente en cada caso, qué existe hoy |
| 9 | [Flujo del producto](09-flujo-producto.md) | Lo que el usuario vive: onboarding, tablero, seguimiento, calendario |
| 10 | [Contrato del agente](10-contrato-agente.md) | Qué recibe, qué hace y qué devuelve. Se lee sin saber nada de la interfaz |

## Las cuatro decisiones que definen el producto

Atraviesan todas las fases; si alguna se rompe, se rompe Oppy.

1. **Demostrar agencia, no búsqueda.** El jurado — y el usuario — tienen que
   ver que el LLM *decide*. Eso se ve en dos cosas concretas de interfaz:
   los logs de proceso en vivo y las `razones` de cada resultado.
   Son decisiones de diseño, no de backend.
2. **Veracidad como feature, no como disclaimer.** El semáforo de confianza
   (🟢 oficial / 🟡 comunitario / 🔴 desactualizado) es la diferenciación
   real frente a cualquier directorio, y responde por adelantado la pregunta
   más incómoda que existe sobre este producto.
3. **Índice compartido, no búsqueda por usuario.** El cron descubre una vez
   para todos; el matching por persona es barato. Es lo que separa un demo
   de un negocio. Ver [modelo de negocio](06-modelo-negocio.md).
4. **Accesibilidad como parte del producto.** Si Oppy existe para cerrar una
   brecha de acceso, la interfaz no puede abrir otra.
5. **Producto y agente son dos lados de una frontera.** El frontend construye el
   perfil y presenta; el agente busca, razona y recomienda. El usuario nunca
   siente que habla con varios agentes: usa Oppy, y por detrás los agentes
   trabajan. Ver [flujo del producto](09-flujo-producto.md) y
   [contrato del agente](10-contrato-agente.md).

## El producto no es un buscador

Después del onboarding, **el usuario no vuelve a buscar**. El centro de Oppy es
un tablero personal que se actualiza solo: el agente descubre, evalúa y avisa; la
persona revisa, organiza y decide a cuáles darle seguimiento.

La diferencia no es estética. Un buscador se juzga por sus resultados; un agente
se juzga por lo que hace cuando nadie lo está mirando — y eso es exactamente lo
que evalúa el track.

## Doble narrativa, un solo producto

- **La humana**: reducir la ansiedad de *"¿y si hay algo ahí afuera que
  podría cambiar mi vida y nunca me enteré?"*. Casos: tu mamá, un familiar
  mayor, alguien que no puede ver la pantalla.
- **La técnica**: un agente autónomo con tool-calling real sobre fuentes
  bolivianas que nadie indexa bien.
- **La comercial**: las empresas y universidades pagan por llegar a esa
  gente; la gente nunca paga.

Regla de coherencia: **el MVP se construye para el estudiante universitario
boliviano**. Los demás perfiles son el mismo motor con otra entrada — no
features distintos. El motor es idéntico; cambia el perfil.

## Estado

- [x] Problema definido
- [x] Solución y alcance del MVP
- [x] Módulos y contratos
- [x] Modelo de negocio (consumo + empresas)
- [x] H0 — Fundaciones de diseño en Figma
  - [x] 70 variables en 3 colecciones (Primitives · Semantic · Scale), Light/Dark
  - [x] Badge de confianza — 3 variantes
  - [x] Barra de match score
  - [x] Card de oportunidad
  - [ ] Botón, input, chip como componentes propios
- [x] H1 — Esqueleto vertical (código generado, 31 pruebas en verde)
  - [x] Backend completo: config, DB, repositorios, servicios, rutas, jobs
  - [x] Frontend: tokens, componentes del design system, 3 vistas
  - [x] Despliegue: `render.yaml`, `netlify.toml`, README
  - [ ] Conectar contra Postgres y Ollama reales
- [ ] **H2 — Índice real** ← siguiente: verificar las 5 fuentes bolivianas a mano
- [ ] H3 — Razonamiento (probar scoring con los 3 perfiles del seed)
- [ ] H4 — Producto visible

## Por confirmar

- Tamaño del equipo y quién toma cada módulo ([reparto sugerido](03-modulos.md))
- Reglas del evento sobre código pre-escrito
