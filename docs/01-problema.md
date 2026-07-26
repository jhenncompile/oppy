# Fase 1 — Definición de problema

## Enunciado

> Existen oportunidades, pero las personas no saben dónde están, se enteran
> tarde, o simplemente nunca llegan a conocerlas.

En Bolivia y LatAm se publican cada semana cientos de becas, pasantías,
empleos, intercambios, concursos y fondos, dispersos en portales
universitarios, embajadas, ONGs, fundaciones, aceleradoras, LinkedIn y redes
sociales institucionales. Nadie tiene tiempo de rastrearlos todos.

**El costo no es falta de mérito, es falta de descubrimiento.**

## Las dos capas del problema

| Capa | Formulación | Para quién pesa |
|------|-------------|-----------------|
| Funcional | La información está fragmentada y no llega a tiempo | Jurado técnico, usuarios activos |
| Emocional | La ansiedad de estar perdiéndose algo que podría cambiar tu vida | Pitch, impacto social |

La capa emocional es la que hace que el producto importe; la funcional es la
que se puede medir. El pitch abre con la primera y demuestra con la segunda.

## Usuario objetivo

**Primario (el del MVP):** estudiante universitario boliviano (UAGRM, UPB,
UMSA, UCB) o joven profesional buscando becas, pasantías o financiamiento.
Tiene perfil digital, revisa el celular, y hoy pierde horas googleando
"becas 2026 Bolivia".

**Secundarios (visión, mismo motor, otro perfil de entrada):**

| Perfil | Situación | Qué necesita de Oppy |
|--------|-----------|---------------------|
| Madre que perdió su empleo, 45 | Experiencia administrativa, busca cerca de casa | Empleos compatibles, cursos gratuitos, horarios flexibles |
| Persona mayor, 60 | Mucha experiencia, descartada por edad | Consultorías, mentorías, trabajo por experiencia |
| Persona con discapacidad visual | Barrera de interfaz, no de capacidad | Voz, resumen hablado, navegación accesible |

Estos perfiles no son features separados: son entradas distintas al mismo
loop. Diseñar el MVP para el estudiante sin romper estos casos es un
requisito de arquitectura, no un "después vemos".

## Por qué no está resuelto

- Los buscadores de becas existentes (ProFellow, Scholarship.com) están
  centrados en EE.UU./Europa y **no indexan fuentes bolivianas**: embajadas
  en Bolivia, AGCID, Konrad Adenauer Bolivia, fundaciones universitarias,
  portales de empleo locales, aceleradoras nacionales.
- Son **directorios estáticos**, no agentes: listan todo igual para todos y
  no razonan sobre elegibilidad real.
- Nadie asume el problema de la **veracidad**: convocatorias vencidas,
  enlaces muertos, información replicada sin fecha.

## Métricas de éxito

| Métrica | Objetivo MVP | Cómo se mide |
|---------|--------------|--------------|
| Oportunidades relevantes por búsqueda | ≥5 con `match_score` >70 | Salida del agente en la demo |
| Precisión de elegibilidad | ≥80% de los top-5 realmente aplicables al perfil | Revisión manual sobre 3 perfiles de prueba |
| Tiempo de descubrimiento | < 90s vs. horas de búsqueda manual | Cronómetro en la demo |
| Fuentes verificadas | 100% con enlace original y fecha visible | Inspección del dashboard |
| Autonomía real | Cron corriendo sin intervención | Log del scheduled job en Render |

## Alcance

**Dentro (MVP):** descubrimiento y recomendación personalizada de
oportunidades a partir de un perfil, con justificación y señal de confianza.

**Fuera (explícito):** postular por el usuario, gestionar documentos,
construir CV, red social, pagos, cobertura exhaustiva del mercado laboral.

## Restricciones

24h de desarrollo · fuentes públicas únicamente · presupuesto de API
limitado · demo en vivo con red del evento (riesgo real) · contenido y
requisitos en español boliviano.
