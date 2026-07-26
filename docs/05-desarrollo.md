# Fase 5 — Desarrollo (24h)

## Stack

| Capa | Elección | Nota |
|------|----------|------|
| Frontend | React + TailwindCSS, deploy en Netlify | Tokens de Figma → config de Tailwind |
| Backend | Node.js + Express, deploy en Render | `routes/`, `services/agent/`, `services/scraping/`, `services/scoring/` |
| DB | PostgreSQL | Perfiles, oportunidades cacheadas, dedupe |
| Búsqueda semántica | Exa | Encuentra convocatorias que el keyword search no indexa |
| Scraping | Firecrawl | Extracción estructurada de fuentes ya identificadas |
| Cron | Render Cron Jobs (o `node-cron`) | Prueba de autonomía |
| Voz *(bonus)* | Wispr Flow (entrada) · ElevenLabs (briefing) | Solo si el núcleo corre |

### Decisión pendiente: el modelo

El PRD menciona Ollama para el orquestador. En un demo en vivo eso trae dos
riesgos concretos: latencia alta y costo/tamaño de instancia en Render.
Recomendación: **API hospedada para el scoring** (es el camino crítico de la
demo). Si querés mantener un modelo local como parte de la narrativa de
soberanía tecnológica, usalo para una tarea no crítica — por ejemplo la
normalización — y decilo en el pitch. Lo que el jurado premia en el track de
agentes es tool-calling real, no modelo propio; el fine-tuning
(LoRA/QLoRA + Adaptive Lab) es una historia de roadmap excelente, pero en
24h es una vía de fracaso segura.

## Antes del evento

Verificar reglas del buildathon sobre código pre-escrito. Lo que casi
siempre está permitido y conviene tener listo:

- [ ] Cuentas y API keys de Exa, Firecrawl, LLM, Render, Netlify probadas
- [ ] **Queries ejecutadas a mano** contra las fuentes candidatas (H1 y H4
      de la fase 2) — esto se hace sí o sí, no es código
- [ ] Lista final de 3–5 fuentes estables + 2 de respaldo
- [ ] Esquema de oportunidad congelado (fase 3)
- [ ] Tokens de diseño exportados
- [ ] Guion del pitch escrito y cronometrado

## Las 24 horas

| Bloque | Objetivo | Punto de control |
|--------|----------|------------------|
| **H0–H2** | Repos, deploy vacío en Render y Netlify, DB conectada, contrato de API acordado | Frontend y backend desplegados y hablándose |
| **H2–H6** | **Esqueleto vertical**: perfil hardcodeado → 1 fuente → LLM → 1 card | 🚩 Fin a fin funcionando, aunque sea feo |
| **H6–H10** | Explorador completo (Exa + Firecrawl, paralelo) + normalización + dedupe | ≥20 oportunidades reales en DB |
| **H10–H14** | Scoring con `por_que_calza` + módulo de confianza | Top-5 con justificación creíble en 3 perfiles distintos |
| **H14–H18** | Dashboard real según Figma: onboarding, proceso en vivo, cards, detalle, estados | 🚩 Demo presentable end-to-end |
| **H18–H20** | Cron en Render corriendo para 2 usuarios demo | Log visible del job ejecutado solo |
| **H20–H22** | Bonus (voz/audio) **solo si los dos 🚩 están verdes** · README · deploy final | — |
| **H22–H24** | Congelar código. Ensayar el pitch 3 veces. Grabar video de respaldo | 🚩 Demo ensayada, nada se toca |

**Regla dura:** a la hora 20 se congela el alcance. Cualquier idea nueva va
a una lista de "roadmap" que se menciona en el pitch, no al código.

## Definition of Done por módulo

- [ ] Coincide con el diseño de Figma, incluidos estados vacío/carga/error
- [ ] Sin datos hardcodeados en el camino de la demo
- [ ] Falla de forma elegante: si una fuente cae, el resto sigue
- [ ] Probado con **3 perfiles distintos**, no solo el tuyo

## Riesgos y mitigación

| Riesgo | Mitigación |
|--------|-----------|
| Rate limits o resultados vacíos en vivo | 2 fuentes de estructura estable como fallback; queries probadas antes |
| LLM lento en la demo | La pantalla de proceso en vivo convierte la espera en prueba de autonomía |
| Red del evento falla | Video de respaldo grabado + prototipo de Figma navegable |
| Scope creep (voz + imágenes + WhatsApp) | Núcleo primero; los dos 🚩 son la condición para tocar bonus |
| "¿Esto escala?" | Agregar fuentes es declarativo (config de targets); el cuello es el LLM y se cachea por perfiles similares |
| "¿Y la veracidad?" | El semáforo ya está en pantalla — respuesta demostrada, no prometida |

## Guion del pitch (4 min)

1. **(30s) Problema** — 3 pestañas abiertas buscando becas. Caos. Cerrar
   con la frase humana: "no es falta de mérito, es falta de descubrimiento".
2. **(30s) Onboarding** — perfil en vivo (por voz si el bonus entró).
3. **(90s) Demo** — click en Buscar → **pantalla de proceso narrando** →
   resultados con score y `por_que_calza` → abrir una card y mostrar
   confianza + fuente + fecha.
4. **(60s) Autonomía** — el cron corriendo en Render. "Esto ya funcionó
   mientras yo hablaba."
5. **(30s) Cierre** — mercado, roadmap (WhatsApp, más fuentes, otros
   perfiles: tu mamá, alguien de 60, alguien que no puede ver la pantalla).
   Cerrar con: *"Oppy no busca oportunidades para llenar vacantes; busca
   oportunidades para que las personas puedan avanzar."*

## README (requisito del track)

Qué hace en 1 línea · setup en <5 pasos · variables de entorno ·
diagrama de arquitectura · URL desplegada · qué es real y qué es roadmap.
