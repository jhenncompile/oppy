# Fase 2 — Solución

## Propuesta de valor

Para el **estudiante o profesional joven boliviano** que sabe que hay
oportunidades pero no dónde ni cuándo, **Oppy** es un **agente personal de
descubrimiento** que rastrea fuentes locales y regionales, razona si cada
oportunidad realmente aplica a tu perfil, y te avisa con tiempo. A
diferencia de los directorios de becas, Oppy **decide por vos qué es
relevante y te dice por qué**.

Tono del producto: acompañante, no buscador.
> "Encontré algo que podría servirte."

## El loop del agente

Esto es lo que separa a Oppy de un chatbot con buscador:

1. **Percibe** — recibe el perfil (carrera, nivel, intereses, ubicación,
   idiomas) por formulario o por voz.
2. **Decide** — el orquestador determina qué fuentes rastrear y qué queries
   generar para *ese* perfil. No hay lista fija de búsquedas.
3. **Ejecuta** — dispara búsqueda semántica y scraping en paralelo,
   normaliza todo a un esquema común.
4. **Evalúa** — razona sobre elegibilidad real ("pide GPA 3.5+, inglés B2,
   carrera STEM") y produce `compatibilidad`, `razones[]` y `brechas[]`.
5. **Entrega** — dashboard priorizado con next steps y deadline.
6. **Aprende** — guardar/descartar ajusta futuras recomendaciones *(roadmap)*.

Y corre **en background por cron**, no solo cuando le preguntás. Esa es la
diferencia entre "chatbot que busca" y "agente que monitorea por vos".

## Los cuatro roles del agente

Son roles conceptuales del sistema; en el código se implementan como
servicios (ver fase 3).

| Rol | Función | ¿En el MVP? |
|-----|---------|-------------|
| 🔍 Explorador | Busca oportunidades constantemente en fuentes locales | Sí — núcleo |
| 🧠 Analista | Lee y entiende requisitos, fechas, beneficios, ubicación | Sí — núcleo |
| 🎯 Compatibilidad | Responde "¿esto realmente es para esta persona?" — 5 resultados, no 500 | Sí — núcleo |
| 🤝 Acompañante | "Cierra en 5 días", "te falta esta habilidad, acá hay un curso" | Parcial — solo alertas de deadline |

El Acompañante es el que convierte a Oppy en producto de largo plazo, pero
en 24h solo entra su versión mínima.

## Sistema de confianza (diferenciador)

El problema de la veracidad se ataca de frente y se muestra en la interfaz:

| Señal | Significado | Regla |
|-------|-------------|-------|
| 🟢 Verificada | Fuente oficial (embajada, universidad, fundación reconocida) | Dominio en lista blanca + enlace vivo |
| 🟡 Por validar | Fuente comunitaria o agregador | Se muestra, marcada, con enlace a la fuente original |
| 🔴 Desactualizada | Deadline vencido o sin fecha detectable | Se despriorizada o se oculta tras filtro |

Todo resultado muestra siempre: **fuente original + fecha de extracción +
enlace directo**. Esto no es un disclaimer legal, es parte de la innovación
y responde por adelantado la pregunta del jurado.

## Alcance del MVP (24h)

Debe funcionar **en vivo, sin datos hardcodeados**.

| Prioridad | Funcionalidad |
|-----------|---------------|
| **Must** | Perfil de 3–4 campos · búsqueda real disparada por el perfil (búsqueda semántica + scraping de 3–5 fuentes bolivianas) · scoring LLM con `razones[]` · dashboard ordenado por compatibilidad · semáforo de confianza · cron real corriendo |
| **Should** | Onboarding por voz · resumen en audio de las top del día · filtros por categoría |
| **Could** | Tarjetas visuales generadas · comparador de oportunidades |
| **Won't** | Notificaciones WhatsApp reales · feedback loop persistente · >5 fuentes · fine-tuning de modelo propio · postulación asistida |

Nota sobre el modelo: **fine-tuning (LoRA/QLoRA sobre Llama/Qwen) no cabe en
24h** y no aporta al criterio de evaluación — el jurado premia
*tool-calling real*, no modelo propio. Va al roadmap como visión de
especialización. Para el MVP, API hospedada por latencia y estabilidad en
vivo (ver fase 5).

## Hipótesis a validar

| # | Hipótesis | Señal de fracaso |
|---|-----------|------------------|
| H1 | Las fuentes bolivianas son scrapeables de forma estable | Estructura cambia o bloquea; mitigar con fuentes fallback |
| H2 | El LLM distingue elegibilidad real, no solo keywords | Recomienda becas para las que el perfil no califica |
| H3 | Las `razones` generan confianza en el usuario | La gente ignora la justificación y solo mira el título |
| H4 | Hay volumen suficiente de oportunidades bolivianas por semana | Búsquedas devuelven <5 resultados relevantes |

H1 y H4 se prueban **antes del evento** ejecutando las queries a mano. Si
fallan, cambia la lista de fuentes, no el producto.

## Flujos críticos

1. **Onboarding** → perfil creado (form o voz)
2. **Búsqueda en vivo** → proceso visible → resultados priorizados
3. **Evaluar oportunidad** → detalle → por qué calza → confianza → aplicar
4. **Monitoreo autónomo** → cron → nuevas oportunidades desde la última vez
