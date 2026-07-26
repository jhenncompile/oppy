# Plan de ejecución — por hitos

Sin horas. Cada hito tiene una condición de "hecho" verificable; no se
avanza al siguiente hasta cumplirla. Si algo se rompe, se recorta desde el
final de la lista, nunca desde el medio.

Stack confirmado por el equipo (Ollama incluido). Único resguardo: que la
llamada al LLM viva detrás de una interfaz (`services/llm/index.js` con una
función `complete()`), para que cambiar de proveedor sea configuración y no
refactor.

---

## H0 — Fundaciones de diseño
**Figma:** https://www.figma.com/design/q2aCurFwPXUrLeJKEX3Gl1/Oppy

- Variables: color semántico, tipografía, espaciado, radios
- Escalas propias: confianza (🟢🟡🔴) y match score
- Componentes base: badge de confianza, barra de score, botón, input, chip
- **Card de oportunidad** con sus variantes

*Hecho cuando:* la card existe como componente con variantes y todo está
enlazado a variables, sin valores sueltos.

## H1 — Esqueleto vertical
Repo, Tailwind con los tokens exportados, Express, PostgreSQL con el
esquema de `06-modelo-negocio.md`, deploys vacíos.
Después: perfil fijo → 1 fuente → LLM → 1 card en pantalla.

*Hecho cuando:* una oportunidad real, traída de internet, se ve en el
navegador. Aunque sea fea.

🚩 **Bandera.** Sin esto, nada de lo demás importa.

## H2 — Índice real
Explorador completo (Exa + Firecrawl en paralelo) → normalizador con
`skills[]` → dedupe → tabla `opportunities`.

*Hecho cuando:* ≥20 oportunidades bolivianas reales, sin duplicados, con
fuente y fecha en la base.

## H3 — Razonamiento
Servicio de scoring **simétrico** `(perfil, oportunidad)` → `match_score` +
`por_que_calza` → tabla `matches`. Módulo de confianza clasificando fuentes.

*Hecho cuando:* con 3 perfiles distintos, los top-5 son creíbles y la
justificación resiste una lectura crítica.

## H4 — Producto visible
En este orden — si el tiempo se acaba, se corta desde abajo:

1. Card de oportunidad
2. Pantalla de resultados
3. **Pantalla de proceso en vivo** — la que prueba que hay un agente
4. Onboarding
5. Detalle
6. Estados vacío y error

*Hecho cuando:* alguien que no trabajó en esto entiende qué hace Oppy sin
que le expliquen.

🚩 **Bandera.** Un onboarding feo con resultados excelentes gana; al revés,
no.

## H5 — Autonomía
Cron sobre el mismo pipeline. Tabla `events` registrando impresiones y
clics.

*Hecho cuando:* hay un log de una ejecución que corrió sola, y los eventos
se están grabando.

## H6 — Capa empresa (mínima, para el pitch)
No hace falta construir el portal B2B. Alcanza con demostrar que la
arquitectura lo soporta:

- Una oportunidad con `origen: 'publicada'` conviviendo con las descubiertas
- El scoring corriendo invertido sobre 2–3 perfiles demo (matching inverso)
- Una consulta agregada sobre `skills[]` — "las 10 habilidades más pedidas
  esta semana en Bolivia"

*Hecho cuando:* podés responder "¿y cómo ganan plata?" mostrando algo que
corre, no una diapositiva.

## H7 — Empaque
README con setup en <5 pasos, variables de entorno, diagrama, URL
desplegada. Qué es real y qué es roadmap, dicho explícitamente.

*Hecho cuando:* alguien clona el repo y lo levanta sin preguntarte nada.

## H8 — Congelado
Se ensaya. No se toca el código. Video de respaldo grabado.

*Hecho cuando:* la demo se corrió entera tres veces sin sorpresas.

---

## Regla de recorte

Si hay que sacrificar algo, el orden de sacrificio es: H8 → H6 → H5 → H7.
**H1 a H4 no son negociables**: son el producto.
